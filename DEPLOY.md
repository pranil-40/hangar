# Putting Hangar online

Local SQLite is fine for you alone. The moment someone else needs to log in,
you need a real database and a real URL. This is that path.

Budget about 40 minutes the first time. Everything here has a free tier.

---

## 1. A database (Neon, free)

SQLite is a file on your laptop, so it cannot be shared. Postgres can.

1. Sign up at [neon.com](https://neon.com) and create a project.
2. Copy the connection string. It looks like
   `postgresql://user:password@ep-something.aws.neon.tech/neondb?sslmode=require`.

Keep that string somewhere safe for the next steps. It is a password — do not
paste it into the repo, a chat, or an issue.

## 2. Switch the project to Postgres

One line in [`prisma/schema.prisma`](prisma/schema.prisma):

```prisma
datasource db {
  provider = "postgresql"   // was "sqlite"
}
```

Nothing else in the code changes. `src/lib/prisma-client.ts` already picks the
right driver from the URL scheme, and both drivers are installed.

Then point your local `.env` at Neon and create the tables:

```bash
npx prisma db push
npm run db:seed
npm run dev
```

If that works locally against Neon, it will work in production. Deploying a
database change you have not run locally is how a demo dies.

> Going back to SQLite is the same line in reverse plus
> `DATABASE_URL="file:./prisma/dev.db"`.

## 3. Deploy (Vercel, free)

Vercel is made by the people who make Next.js, so this is the least
surprising option.

1. Push this repo to GitHub (see the README if it is not there yet).
2. Sign in at [vercel.com](https://vercel.com) with GitHub.
3. **Add New → Project**, pick the `hangar` repo, and **Import**.
4. Before clicking Deploy, open **Environment Variables** and add all three:

   | Name             | Value                                              |
   | ---------------- | -------------------------------------------------- |
   | `DATABASE_URL`   | your Neon connection string                        |
   | `SESSION_SECRET` | a fresh random value — see below                   |
   | `APP_URL`        | `https://your-project.vercel.app`                  |

   Generate a secret with:

   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

   **Use a different secret from your local one.** The app refuses to start in
   production with the example value, but it cannot tell whether you reused a
   development secret — that is on you. The secret signs login cookies;
   anyone holding it can forge a session for any account.

5. Deploy. The build runs `prisma generate && next build`, which is already
   set in `package.json`.

6. After the first deploy, set `APP_URL` to the real URL Vercel gave you and
   redeploy. Invite links are built from it, so if it is wrong your pilots
   get links that go nowhere.

## 4. Create the tables in production

Neon starts empty. From your machine, with `DATABASE_URL` pointing at Neon:

```bash
npx prisma db push
```

Do **not** run `npm run db:seed` against production unless you want the Acme
Ops demo team and three accounts with the password `hangar123` sitting in your
real database.

## 5. Check it

- Open the URL, create an account, create a team, add a tool.
- Invite a second email, open the invite link in a private window, and
  confirm the roles behave.
- Run `npm run metric` with `DATABASE_URL` pointing at Neon to read real usage.

---

## Before real pilots use it

Three gaps that are fine for a demo and not fine for a team that depends on it.
They are listed in the README too.

- **No password reset.** If a pilot user forgets theirs, you fix it by hand in
  the database. Acceptable for five teams; not for fifty.
- **Sessions cannot be revoked.** Signing out clears the cookie locally, but a
  copied cookie stays valid for 30 days. Add a session table when you have
  users you cannot phone.
- **Invites are copy-paste links.** Wire up an email provider (Resend is about
  an hour) once copy-paste starts costing you onboarding calls.

## Custom domain

Vercel → Project → Settings → Domains. Then update `APP_URL` and redeploy.
Worth doing before you send the application; `hangar.com` reads better than
`hangar-git-main-pranil.vercel.app`.
