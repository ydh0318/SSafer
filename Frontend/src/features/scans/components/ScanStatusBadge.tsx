import type { ScanStatus } from '../../../types/scan';
import { getScanStatusClassName, getScanStatusLabel } from '../utils/scanPresentation';

function ScanStatusBadge({ status }: { status: ScanStatus }) {
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${getScanStatusClassName(status)}`}>
      {getScanStatusLabel(status)}
    </span>
  );
}

export default ScanStatusBadge;
