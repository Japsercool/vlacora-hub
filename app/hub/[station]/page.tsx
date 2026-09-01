import { redirect } from "next/navigation";

export default function StationHome({ params }: { params: { station: string } }) {
  redirect(`/hub/${params.station}/dashboard`);
}
