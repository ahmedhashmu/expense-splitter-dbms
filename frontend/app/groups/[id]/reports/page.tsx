import { redirect } from "next/navigation";

// old link, kept so bookmarks still work
export default async function Moved({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/groups/${id}/insights`);
}
