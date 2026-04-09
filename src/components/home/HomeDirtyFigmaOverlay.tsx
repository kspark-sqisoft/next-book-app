/**
 * CodeSandbox zxpv7 `DirtyFigmaExport.js` — 원본 타이포·그리드 레이어.
 * `styles.css`의 `.full`(max-width: 568px에서 숨김) → `max-[568px]:hidden`.
 */

const antonio = {
  fontFamily: "var(--font-antonio), Antonio, sans-serif",
} as const;

function Underlay() {
  return (
    <div
      className="pointer-events-none absolute inset-0 z-10 flex min-h-0 flex-col p-10 text-black dark:text-neutral-100"
      aria-hidden
    >
      <div className="flex w-full flex-row items-center justify-center">
        <p
          className="h-[30px] flex-[1_1_0%] text-[30px] font-bold leading-[30px] tracking-[1px]"
          style={antonio}
        >
          PARK KEESOON
        </p>
        <div className="flex flex-[1_1_0%] gap-[2em]" />
        <p className="h-[30px] flex-[1_1_0%] text-right text-[30px] leading-[30px]">
          ⎑
        </p>
      </div>

      <div className="h-[60px]" />

      <div className="flex w-full flex-row items-start justify-center">
        <p className="flex-[1_1_0%] text-xs leading-[1.5em]">
          <b>Stones, Metals and Gems</b>
          <br />
          A Universal Deity
          <br />
          <b>—</b>
        </p>
        <div className="w-2.5 shrink-0" />
        <p
          className="whitespace-nowrap text-right text-xs font-bold leading-none"
          style={{
            transform: "rotate3d(0, 0, 1, 90deg) translate3d(100%, 10px, 0)",
            transformOrigin: "right",
          }}
        >
          DRAG POINTER &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; ●
        </p>
      </div>

      <div className="h-2.5" />

      <div
        className="flex w-full max-[568px]:hidden min-h-0 flex-[1_1_0%] flex-row items-end justify-center"
        style={antonio}
      >
        <p className="m-0 flex-[1_1_0%] text-[250px] leading-none tracking-[-10px]">
          X
        </p>
        <div className="w-2.5 shrink-0" />
        <p className="m-0 flex-[1_1_0%] text-right text-[250px] leading-none tracking-[-10px]">
          _01
        </p>
      </div>

      <div className="h-[60px]" />

      <div className="pointer-events-auto flex w-full flex-row items-end justify-center">
        <p className="max-[568px]:hidden flex-[1_1_0%] whitespace-nowrap text-xs leading-[1.5em]">
          <b>Wonders of Antiquity</b>
          <br />
          Pythagorean Mathematics
        </p>
        <div className="w-2.5 shrink-0 max-[568px]:hidden" />
        <p
          className="max-[568px]:hidden flex-[1_1_0%] text-center text-base font-bold leading-none tracking-[-0.5px] whitespace-nowrap"
          style={antonio}
        >
          THE SUMMIT OF THE MANY
        </p>
        <div className="w-2.5 shrink-0 max-[568px]:hidden" />
        <p className="max-[568px]:hidden flex-[1_1_0%] text-right text-xs leading-none" />
      </div>
    </div>
  );
}

function Overlay() {
  return (
    <div className="pointer-events-auto absolute bottom-10 right-10 z-10 text-xs leading-none text-black dark:text-neutral-100">
      <p className="text-right">
        <a
          href="https://pmnd.rs/"
          target="_blank"
          rel="noopener noreferrer"
          className="cursor-pointer pr-2.5 text-inherit no-underline hover:underline"
        >
          pmnd.rs
        </a>
        <a
          href="https://github.com/pmndrs"
          target="_blank"
          rel="noopener noreferrer"
          className="cursor-pointer pr-2.5 text-inherit no-underline hover:underline"
        >
          git
        </a>
        <a
          href="https://codesandbox.io/s/zxpv7"
          target="_blank"
          rel="noopener noreferrer"
          className="cursor-pointer text-inherit no-underline hover:underline"
        >
          csb
        </a>
      </p>
    </div>
  );
}

export function HomeDirtyFigmaOverlay() {
  return (
    <>
      <Underlay />
      <Overlay />
    </>
  );
}
