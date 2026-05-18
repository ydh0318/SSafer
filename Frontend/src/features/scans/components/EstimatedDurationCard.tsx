type EstimatedDurationCardProps = {
  label?: string;
  duration?: string;
};

function EstimatedDurationCard({
  label = '파일 업로드 스캔 기준 · P95',
  duration = '~30초',
}: EstimatedDurationCardProps) {
  return (
    <div className="bg-[#D4FC64] p-6 text-[#0F0F0F] landing-card-radius">
      <div className="text-4xl font-black tracking-tight md:text-5xl">{duration}</div>
      <p className="mt-2.5 text-xs font-medium text-[#0F0F0F]/70">{label}</p>
    </div>
  );
}

export default EstimatedDurationCard;
