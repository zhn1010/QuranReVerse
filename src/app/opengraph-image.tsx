import { ImageResponse } from 'next/og';

export const alt = 'Sakinah.now Quran-centered reflection for inner calm';
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = 'image/png';

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          background:
            'linear-gradient(135deg, rgb(247, 242, 230) 0%, rgb(240, 231, 211) 48%, rgb(221, 202, 161) 100%)',
          color: 'rgb(33, 27, 18)',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            width: '100%',
            height: '100%',
            padding: '64px 72px',
            border: '2px solid rgba(110, 88, 44, 0.12)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 18,
              fontSize: 28,
              letterSpacing: '0.24em',
              textTransform: 'uppercase',
              color: 'rgb(121, 90, 42)',
            }}
          >
            <div
              style={{
                width: 18,
                height: 18,
                borderRadius: 999,
                background: 'rgb(148, 113, 54)',
              }}
            />
            Sakinah.now
          </div>

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              maxWidth: 880,
            }}
          >
            <div
              style={{
                display: 'flex',
                fontSize: 76,
                lineHeight: 1.05,
                fontWeight: 700,
                letterSpacing: '-0.04em',
              }}
            >
              Quran-centered reflection for inner calm
            </div>
            <div
              style={{
                display: 'flex',
                marginTop: 28,
                fontSize: 34,
                lineHeight: 1.35,
                color: 'rgb(87, 70, 37)',
              }}
            >
              Move from overwhelm to steadier sight through a guided reflection path.
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              fontSize: 24,
              color: 'rgb(102, 79, 39)',
            }}
          >
            sakinah.now
          </div>
        </div>
      </div>
    ),
    size,
  );
}
