"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useUserProfile, profileInitials } from "@/lib/user-profile";

export default function ProfilePage() {
  const { profile, updateUsername } = useUserProfile();
  return <ProfileForm key={`${profile.email}|${profile.username}`} initialUsername={profile.username} email={profile.email} updateUsername={updateUsername} />;
}

function ProfileForm({ initialUsername, email, updateUsername }: {
  initialUsername: string;
  email: string;
  updateUsername: (value: string) => void;
}) {
  const [username, setUsername] = useState(initialUsername);
  const [savedUsername, setSavedUsername] = useState(initialUsername);
  const save = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const next = username.trim();
    if (!next) { toast.error("Enter a username first."); return; }
    if (next.length > 48) { toast.error("Keep your username under 49 characters."); return; }
    updateUsername(next);
    setUsername(next);
    setSavedUsername(next);
    toast.success("Username saved on this device");
  };

  return (
    <div className="profile-page mx-auto max-w-[760px] pb-10">
      <header className="border-b border-border pb-6">
        <p className="mb-1 text-sm font-semibold text-destructive">Your account</p>
        <h1 className="text-[2.15rem] font-semibold leading-tight tracking-[-0.035em] sm:text-[2.55rem]">Profile</h1>
        <p className="mt-2 text-base text-muted-foreground">Your sign-in email is shown by default. Set a username if you prefer.</p>
      </header>

      <div className="flex items-center gap-4 border-b border-border py-7">
        <span className="grid h-14 w-14 shrink-0 place-items-center rounded-lg bg-primary/10 text-xl font-semibold text-primary" aria-hidden="true">
          {profileInitials(savedUsername)}
        </span>
        <div className="min-w-0">
          <p className="truncate text-xl font-semibold">{savedUsername || email}</p>
          <p className="text-sm text-muted-foreground">Your display name</p>
        </div>
      </div>

      <form onSubmit={save} className="space-y-6 py-7">
        <div className="space-y-2">
          <label htmlFor="profile-username" className="block text-base font-semibold">Username</label>
          <Input id="profile-username" name="username" autoComplete="nickname" maxLength={48} value={username} onChange={(event) => setUsername(event.target.value)} placeholder="How should we address you?" className="h-11 text-base" required />
          <p className="text-sm text-muted-foreground">Shown across the dashboard. Changes to this display name are saved in this browser.</p>
        </div>
        <div className="space-y-2">
          <label htmlFor="profile-email" className="block text-base font-semibold">Sign-in email</label>
          <Input id="profile-email" type="email" value={email} readOnly aria-readonly="true" className="h-11 bg-muted/35 text-base" />
          <p className="text-sm text-muted-foreground">This comes from your signed-in account and cannot be changed here.</p>
        </div>
        <Button type="submit" disabled={!username.trim() || username.trim() === savedUsername}>Save username</Button>
      </form>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-5 text-sm">
        <span className="text-muted-foreground">Agent spending rules are managed separately.</span>
        <Link href="/authority" className="inline-flex items-center gap-1 font-semibold underline decoration-border underline-offset-4 hover:text-destructive">View authority <ArrowUpRight className="h-4 w-4" /></Link>
      </div>
    </div>
  );
}
