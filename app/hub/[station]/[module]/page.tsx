import HubApp from "@/components/hub-app";

export default function HubModule({
  params,
}: {
  params: { station: string; module: string };
}) {
  return <HubApp stationSlug={params.station} moduleSlug={params.module} />;
}
