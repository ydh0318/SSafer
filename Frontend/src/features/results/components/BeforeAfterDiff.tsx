type BeforeAfterDiffProps = {
  before: string;
  after: string;
};

function BeforeAfterDiff({ before, after }: BeforeAfterDiffProps) {
  return (
    <div className="grid gap-4">
      <div>
        <p className="mb-2 text-sm font-bold text-red-700">Before</p>
        <pre className="min-h-28 overflow-auto whitespace-pre-wrap rounded-lg bg-red-50 p-4 text-sm leading-6 text-red-900">
          <code>{before}</code>
        </pre>
      </div>
      <div>
        <p className="mb-2 text-sm font-bold text-emerald-700">After</p>
        <pre className="min-h-28 overflow-auto whitespace-pre-wrap rounded-lg bg-emerald-50 p-4 text-sm leading-6 text-emerald-900">
          <code>{after}</code>
        </pre>
      </div>
    </div>
  );
}

export default BeforeAfterDiff;
