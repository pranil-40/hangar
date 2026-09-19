"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/password";
import { createSession, destroySession } from "@/lib/session";

export type FormState = { error?: string };

const emailField = z.string().trim().toLowerCase().email("Enter a valid email address.");

const signupSchema = z.object({
  name: z.string().trim().min(1, "Enter your name.").max(80),
  email: emailField,
  password: z.string().min(8, "Use at least 8 characters."),
});

const loginSchema = z.object({
  email: emailField,
  password: z.string().min(1, "Enter your password."),
});

export async function signupAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = signupSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const { name, email, password } = parsed.data;

  const existing = await db.user.findUnique({ where: { email }, select: { id: true } });
  if (existing) {
    return { error: "An account with that email already exists." };
  }

  const user = await db.user.create({
    data: { name, email, passwordHash: await hashPassword(password) },
    select: { id: true },
  });

  await createSession(user.id);
  redirect("/teams");
}

export async function loginAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const user = await db.user.findUnique({
    where: { email: parsed.data.email },
    select: { id: true, passwordHash: true },
  });

  // Same message either way — a different one for "no such account" would
  // let anyone test which emails are registered.
  const invalid = { error: "That email and password do not match." };
  if (!user) return invalid;
  if (!(await verifyPassword(parsed.data.password, user.passwordHash))) return invalid;

  await createSession(user.id);
  redirect("/teams");
}

export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect("/login");
}
