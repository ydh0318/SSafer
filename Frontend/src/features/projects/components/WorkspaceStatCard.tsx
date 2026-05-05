type WorkspaceStatCardProps = {
  label: string;
  value: string;
  helper: string;
};

function WorkspaceStatCard({ label, value, helper }: WorkspaceStatCardProps) {
  return (
    <article className="rounded-[1.5rem] border border-[#ece6d8] bg-white px-5 py-5 shadow-[0_12px_40px_rgba(15,23,42,0.05)]">
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#8b7f6a]">{label}</p>
      <p className="mt-3 text-3xl font-black text-[#111111]">{value}</p>
      <p className="mt-3 text-sm leading-6 text-[#6b6257]">{helper}</p>
    </article>
  );
}

export default WorkspaceStatCard;
