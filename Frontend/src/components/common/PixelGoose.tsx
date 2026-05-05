type PixelGooseMood = 'idle' | 'happy' | 'alert' | 'working' | 'sleeping' | 'victory';

type PixelGooseProps = {
  mood?: PixelGooseMood;
  size?: number;
  className?: string;
};

function PixelGoose({ mood = 'idle', size = 64, className = '' }: PixelGooseProps) {
  const unit = size / 16;
  const pixel = (x: number, y: number, color: string, w = 1, h = 1) => (
    <rect x={x * unit} y={y * unit} width={w * unit} height={h * unit} fill={color} />
  );

  const WHITE = '#FFFFFF';
  const BODY_SHADE = '#E8E8E8';
  const OUTLINE = '#1A1A1A';
  const BEAK = '#FFB627';
  const BEAK_DARK = '#E89B0A';
  const FOOT = '#FF8A33';
  const EYE = '#1A1A1A';
  const BLUSH = '#FFB6B6';
  const RED = '#E63946';
  const GREEN = '#3DDC84';

  if (mood === 'sleeping') {
    return (
      <svg
        className={className}
        height={size}
        style={{ imageRendering: 'pixelated' }}
        viewBox={`0 0 ${size} ${size}`}
        width={size}
      >
        {pixel(2, 8, OUTLINE, 12, 1)}
        {pixel(2, 9, OUTLINE)}
        {pixel(2, 10, OUTLINE)}
        {pixel(13, 9, OUTLINE)}
        {pixel(13, 10, OUTLINE)}
        {pixel(2, 11, OUTLINE, 12, 1)}
        {pixel(3, 9, WHITE, 10, 2)}
        {pixel(4, 9, BODY_SHADE, 8, 1)}
        {pixel(11, 7, OUTLINE)}
        {pixel(12, 7, OUTLINE)}
        {pixel(13, 7, OUTLINE)}
        {pixel(14, 7, OUTLINE)}
        {pixel(11, 8, WHITE, 4, 1)}
        {pixel(15, 8, OUTLINE)}
        {pixel(15, 9, OUTLINE)}
        {pixel(15, 10, OUTLINE)}
        {pixel(15, 11, BEAK)}
        {pixel(13, 8, OUTLINE)}
        <text
          fill={OUTLINE}
          fontFamily="monospace"
          fontSize={2.5 * unit}
          fontWeight="900"
          x={4 * unit}
          y={5 * unit}
        >
          z
        </text>
        <text
          fill={OUTLINE}
          fontFamily="monospace"
          fontSize={3 * unit}
          fontWeight="900"
          x={6 * unit}
          y={3 * unit}
        >
          Z
        </text>
      </svg>
    );
  }

  if (mood === 'alert') {
    return (
      <svg
        className={className}
        height={size}
        style={{ imageRendering: 'pixelated' }}
        viewBox={`0 0 ${size} ${size}`}
        width={size}
      >
        {pixel(2, 1, RED)}
        {pixel(2, 2, RED)}
        {pixel(2, 3, RED)}
        {pixel(2, 5, RED)}
        {pixel(7, 2, OUTLINE, 4, 1)}
        {pixel(6, 3, OUTLINE)}
        {pixel(11, 3, OUTLINE)}
        {pixel(7, 3, WHITE, 4, 1)}
        {pixel(6, 4, OUTLINE)}
        {pixel(11, 4, OUTLINE)}
        {pixel(7, 4, WHITE, 4, 1)}
        {pixel(8, 4, EYE)}
        {pixel(10, 4, EYE)}
        {pixel(11, 5, BEAK)}
        {pixel(12, 5, BEAK_DARK)}
        {pixel(7, 5, OUTLINE)}
        {pixel(11, 5, OUTLINE)}
        {pixel(8, 5, WHITE, 3, 1)}
        {pixel(7, 6, OUTLINE)}
        {pixel(11, 6, OUTLINE)}
        {pixel(8, 6, WHITE, 3, 1)}
        {pixel(5, 7, OUTLINE)}
        {pixel(6, 7, OUTLINE, 7, 1)}
        {pixel(13, 7, OUTLINE)}
        {pixel(4, 8, OUTLINE)}
        {pixel(5, 8, WHITE, 8, 1)}
        {pixel(13, 8, OUTLINE)}
        {pixel(4, 9, OUTLINE)}
        {pixel(5, 9, WHITE, 8, 1)}
        {pixel(13, 9, OUTLINE)}
        {pixel(4, 10, OUTLINE)}
        {pixel(5, 10, BODY_SHADE, 8, 1)}
        {pixel(13, 10, OUTLINE)}
        {pixel(5, 11, OUTLINE)}
        {pixel(6, 11, OUTLINE, 7, 1)}
        {pixel(13, 11, OUTLINE)}
        {pixel(6, 12, FOOT)}
        {pixel(11, 12, FOOT)}
        {pixel(5, 13, FOOT, 3, 1)}
        {pixel(10, 13, FOOT, 3, 1)}
      </svg>
    );
  }

  if (mood === 'working') {
    return (
      <svg
        className={className}
        height={size}
        style={{ imageRendering: 'pixelated' }}
        viewBox={`0 0 ${size} ${size}`}
        width={size}
      >
        {pixel(6, 3, OUTLINE, 4, 1)}
        {pixel(5, 4, OUTLINE)}
        {pixel(10, 4, OUTLINE)}
        {pixel(6, 4, WHITE, 4, 1)}
        {pixel(5, 5, OUTLINE)}
        {pixel(10, 5, OUTLINE)}
        {pixel(6, 5, WHITE, 4, 1)}
        {pixel(6, 5, OUTLINE)}
        {pixel(8, 5, OUTLINE)}
        {pixel(7, 5, EYE)}
        {pixel(9, 5, EYE)}
        {pixel(10, 6, BEAK)}
        {pixel(11, 6, BEAK_DARK)}
        {pixel(6, 6, OUTLINE)}
        {pixel(10, 6, OUTLINE)}
        {pixel(7, 6, WHITE, 3, 1)}
        {pixel(6, 7, OUTLINE)}
        {pixel(10, 7, OUTLINE)}
        {pixel(7, 7, WHITE, 3, 1)}
        {pixel(4, 8, OUTLINE)}
        {pixel(5, 8, OUTLINE, 7, 1)}
        {pixel(12, 8, OUTLINE)}
        {pixel(3, 9, OUTLINE)}
        {pixel(4, 9, WHITE, 8, 1)}
        {pixel(12, 9, OUTLINE)}
        {pixel(3, 10, OUTLINE)}
        {pixel(4, 10, BODY_SHADE, 8, 1)}
        {pixel(12, 10, OUTLINE)}
        {pixel(4, 11, OUTLINE)}
        {pixel(5, 11, OUTLINE, 7, 1)}
        {pixel(12, 11, OUTLINE)}
        {pixel(5, 12, FOOT)}
        {pixel(10, 12, FOOT)}
        {pixel(4, 13, FOOT, 3, 1)}
        {pixel(9, 13, FOOT, 3, 1)}
        {pixel(13, 9, OUTLINE)}
        {pixel(13, 10, OUTLINE)}
        {pixel(14, 10, GREEN)}
        {pixel(13, 11, OUTLINE)}
        {pixel(14, 11, GREEN)}
      </svg>
    );
  }

  if (mood === 'happy' || mood === 'victory') {
    return (
      <svg
        className={className}
        height={size}
        style={{ imageRendering: 'pixelated' }}
        viewBox={`0 0 ${size} ${size}`}
        width={size}
      >
        {mood === 'victory' ? pixel(2, 2, GREEN) : null}
        {mood === 'victory' ? pixel(13, 1, GREEN) : null}
        {pixel(6, 3, OUTLINE, 4, 1)}
        {pixel(5, 4, OUTLINE)}
        {pixel(10, 4, OUTLINE)}
        {pixel(6, 4, WHITE, 4, 1)}
        {pixel(5, 5, OUTLINE)}
        {pixel(10, 5, OUTLINE)}
        {pixel(6, 5, WHITE, 4, 1)}
        {pixel(6, 5, EYE)}
        {pixel(7, 4, EYE)}
        {pixel(8, 5, EYE)}
        {pixel(9, 4, EYE)}
        {pixel(6, 6, BLUSH)}
        {pixel(9, 6, BLUSH)}
        {pixel(10, 6, BEAK)}
        {pixel(11, 6, BEAK_DARK)}
        {pixel(6, 6, OUTLINE)}
        {pixel(10, 6, OUTLINE)}
        {pixel(7, 6, WHITE, 3, 1)}
        {pixel(6, 7, OUTLINE)}
        {pixel(10, 7, OUTLINE)}
        {pixel(7, 7, WHITE, 3, 1)}
        {pixel(4, 8, OUTLINE)}
        {pixel(5, 8, OUTLINE, 7, 1)}
        {pixel(12, 8, OUTLINE)}
        {pixel(3, 9, OUTLINE)}
        {pixel(4, 9, WHITE, 8, 1)}
        {pixel(12, 9, OUTLINE)}
        {pixel(3, 10, OUTLINE)}
        {pixel(4, 10, BODY_SHADE, 8, 1)}
        {pixel(12, 10, OUTLINE)}
        {pixel(4, 11, OUTLINE)}
        {pixel(5, 11, OUTLINE, 7, 1)}
        {pixel(12, 11, OUTLINE)}
        {mood === 'victory' ? (
          <>
            {pixel(2, 7, OUTLINE)}
            {pixel(2, 8, WHITE)}
            {pixel(2, 9, OUTLINE)}
            {pixel(13, 7, OUTLINE)}
            {pixel(13, 8, WHITE)}
            {pixel(13, 9, OUTLINE)}
          </>
        ) : null}
        {pixel(5, 12, FOOT)}
        {pixel(10, 12, FOOT)}
        {pixel(4, 13, FOOT, 3, 1)}
        {pixel(9, 13, FOOT, 3, 1)}
      </svg>
    );
  }

  return (
    <svg
      className={className}
      height={size}
      style={{ imageRendering: 'pixelated' }}
      viewBox={`0 0 ${size} ${size}`}
      width={size}
    >
      {pixel(6, 3, OUTLINE, 4, 1)}
      {pixel(5, 4, OUTLINE)}
      {pixel(10, 4, OUTLINE)}
      {pixel(6, 4, WHITE, 4, 1)}
      {pixel(5, 5, OUTLINE)}
      {pixel(10, 5, OUTLINE)}
      {pixel(6, 5, WHITE, 4, 1)}
      {pixel(7, 5, EYE)}
      {pixel(9, 5, EYE)}
      {pixel(10, 6, BEAK)}
      {pixel(11, 6, BEAK_DARK)}
      {pixel(6, 6, OUTLINE)}
      {pixel(10, 6, OUTLINE)}
      {pixel(7, 6, WHITE, 3, 1)}
      {pixel(6, 7, OUTLINE)}
      {pixel(10, 7, OUTLINE)}
      {pixel(7, 7, WHITE, 3, 1)}
      {pixel(4, 8, OUTLINE)}
      {pixel(5, 8, OUTLINE, 7, 1)}
      {pixel(12, 8, OUTLINE)}
      {pixel(3, 9, OUTLINE)}
      {pixel(4, 9, WHITE, 8, 1)}
      {pixel(12, 9, OUTLINE)}
      {pixel(3, 10, OUTLINE)}
      {pixel(4, 10, BODY_SHADE, 8, 1)}
      {pixel(12, 10, OUTLINE)}
      {pixel(4, 11, OUTLINE)}
      {pixel(5, 11, OUTLINE, 7, 1)}
      {pixel(12, 11, OUTLINE)}
      {pixel(5, 12, FOOT)}
      {pixel(10, 12, FOOT)}
      {pixel(4, 13, FOOT, 3, 1)}
      {pixel(9, 13, FOOT, 3, 1)}
    </svg>
  );
}

export default PixelGoose;
