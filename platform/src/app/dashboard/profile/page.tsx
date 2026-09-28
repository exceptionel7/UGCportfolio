import { getSessionUser } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { updateCreatorProfile, updateBrandProfile, updateCustomerProfile } from "@/lib/actions/profile";

export default async function ProfilePage() {
  const user = await getSessionUser();
  if (!user) return null;

  if (user.role === "CREATOR") {
    const creator = await prisma.creator.findUnique({ where: { userId: user.id } });
    const socials = (creator?.socials as { raw?: string } | null)?.raw ?? "";
    return (
      <div>
        <h1 className="font-display font-bold text-2xl mb-1">Creator profile</h1>
        <p className="text-sm text-zinc-400 mb-6">Stored in PostgreSQL. A complete profile wins more campaigns and appears in the marketplace.</p>
        <form action={updateCreatorProfile} className="card p-6 grid sm:grid-cols-2 gap-4">
          <div><label className="label">Display name</label><input className="field" name="name" defaultValue={user.name ?? ""} /></div>
          <div><label className="label">Location</label><input className="field" name="location" defaultValue={creator?.location ?? ""} /></div>
          <div className="sm:col-span-2"><label className="label">Bio</label><textarea className="field" name="bio" rows={3} defaultValue={creator?.bio ?? ""} /></div>
          <div><label className="label">Languages (comma separated)</label><input className="field" name="languages" defaultValue={(creator?.languages ?? []).join(", ")} /></div>
          <div><label className="label">Niches (comma separated)</label><input className="field" name="niches" defaultValue={(creator?.niches ?? []).join(", ")} /></div>
          <div><label className="label">Content categories (comma separated)</label><input className="field" name="categories" defaultValue={(creator?.categories ?? []).join(", ")} /></div>
          <div><label className="label">Content styles (comma separated)</label><input className="field" name="styles" defaultValue={(creator?.styles ?? []).join(", ")} /></div>
          <div><label className="label">Starting rate ($)</label><input className="field" name="rateFrom" type="number" defaultValue={creator?.rateFromCents != null ? creator.rateFromCents / 100 : ""} /></div>
          <div><label className="label">Social links</label><input className="field" name="socials" defaultValue={socials} placeholder="TikTok, Instagram, YouTube…" /></div>
          <div className="sm:col-span-2"><button className="btn btn-primary">Save profile</button></div>
        </form>
      </div>
    );
  }

  if (user.role === "BRAND") {
    const brand = await prisma.brand.findUnique({ where: { userId: user.id } });
    return (
      <div>
        <h1 className="font-display font-bold text-2xl mb-1">Company profile</h1>
        <p className="text-sm text-zinc-400 mb-6">Stored in PostgreSQL.</p>
        <form action={updateBrandProfile} className="card p-6 grid sm:grid-cols-2 gap-4">
          <div><label className="label">Contact name</label><input className="field" name="name" defaultValue={user.name ?? ""} /></div>
          <div><label className="label">Company name</label><input className="field" name="companyName" defaultValue={brand?.companyName ?? ""} /></div>
          <div><label className="label">Website</label><input className="field" name="website" defaultValue={brand?.website ?? ""} placeholder="https://" /></div>
          <div><label className="label">Logo URL</label><input className="field" name="logoUrl" defaultValue={brand?.logoUrl ?? ""} placeholder="https://" /></div>
          <div className="sm:col-span-2"><label className="label">About your brand</label><textarea className="field" name="about" rows={4} defaultValue={brand?.about ?? ""} /></div>
          <div className="sm:col-span-2"><button className="btn btn-primary">Save profile</button></div>
        </form>
      </div>
    );
  }

  // CUSTOMER (and any other)
  const profile = await prisma.profile.findUnique({ where: { userId: user.id } });
  return (
    <div>
      <h1 className="font-display font-bold text-2xl mb-1">Profile</h1>
      <p className="text-sm text-zinc-400 mb-6">Stored in PostgreSQL.</p>
      <form action={updateCustomerProfile} className="card p-6 grid sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2"><label className="label">Name</label><input className="field" name="name" defaultValue={user.name ?? ""} /></div>
        <div className="sm:col-span-2"><label className="label">Address</label><input className="field" name="address" defaultValue={profile?.address ?? ""} /></div>
        <div><label className="label">City</label><input className="field" name="city" defaultValue={profile?.city ?? ""} /></div>
        <div><label className="label">ZIP / Postcode</label><input className="field" name="zip" defaultValue={profile?.zip ?? ""} /></div>
        <div><label className="label">Country</label><input className="field" name="country" defaultValue={profile?.country ?? ""} /></div>
        <div className="sm:col-span-2"><button className="btn btn-primary">Save profile</button></div>
      </form>
    </div>
  );
}
