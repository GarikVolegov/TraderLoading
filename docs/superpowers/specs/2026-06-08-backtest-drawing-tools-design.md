# Backtest Drawing Tools Design

## Context

The backtest replay currently renders candlesticks, replay controls, volume histogram, trade markers, stop-loss/take-profit guide lines, and per-session replay persistence inside `ChartReplay`. Users need chart-analysis tools directly inside the backtest so they can mark setups while replaying historical data.

The chosen interface direction is a vertical toolbar over the left side of the chart, similar to a trading terminal. This keeps the chart readable while making drawing tools immediately available.

## Goals

- Add a vertical tool palette inside the backtest chart area.
- Support manual drawing tools:
  - rectangle;
  - Fibonacci retracement;
  - arrow;
  - straight line.
- Support customizable drawing style:
  - stroke color;
  - stroke width;
  - opacity;
  - line style;
  - rectangle fill opacity;
  - Fibonacci visible levels.
- Add an automatic SVP daily volume-profile indicator.
- Persist drawings and tool settings per backtest session.
- Keep replay behavior intact:
  - all timeframes still start from 120 visible candles;
  - replay controls, trade placement, SL/TP clicks, and progress display remain usable.

## Non-Goals

- No full TradingView clone.
- No multi-user/shared annotations.
- No server-side drawing storage in this iteration.
- No arbitrary/manual SVP range selector in this iteration.
- No order-entry changes.

## UI Design

### Toolbar

The chart area gets a compact vertical toolbar pinned to the left edge. Buttons use icons with tooltips:

- select/move;
- rectangle;
- Fibonacci;
- arrow;
- line;
- SVP toggle;
- delete selected;
- clear all;
- undo for the last local drawing action.

On small screens the toolbar remains vertical with compact icon spacing. Destructive actions such as clear all are placed behind a small overflow menu to avoid accidental taps.

### Properties Panel

Selecting a drawing opens a small contextual properties panel near the toolbar or top-left of the chart. The panel exposes only relevant options:

- common options: color, width, opacity, line style;
- rectangle: fill opacity;
- Fibonacci: level visibility and color;
- SVP: rows, value-area percent, opacity, POC color, VAH/VAL color, side preference.

The panel should not cover core replay controls or trade buttons.

## Drawing Model

Manual drawings are stored as chart-domain coordinates rather than screen pixels:

- time coordinates use candle timestamps;
- price coordinates use price values;
- shape style is stored with each object;
- selected object id is UI state only unless needed for persistence recovery.

The renderer converts domain coordinates to screen coordinates whenever visible candles, timeframe, chart dimensions, or price scale change. This allows drawings to remain attached to market data during replay.

## Rendering Approach

Use a chart overlay layer above the lightweight-charts container:

- `lightweight-charts` continues to render candles, built-in volume histogram, trade markers, SL/TP lines, and time/price scales.
- A positioned SVG overlay renders manual drawings and SVP graphics.
- Pointer events are routed to drawing interactions only when a drawing tool is active or an object is selected.
- Normal chart/trade interactions remain available when the select tool is inactive or no drawing action is in progress.

This keeps the drawing system isolated from the underlying chart library and avoids replacing the existing replay implementation.

## Manual Tool Interactions

### Rectangle

Two-click placement creates a rectangle between two time/price anchors. The rectangle supports stroke and fill customization.

### Straight Line

Two anchor points create a line segment. The line supports color, width, opacity, and line style.

### Arrow

Two anchor points create a directional arrow from start to end. The arrow supports the same styling as a line.

### Fibonacci

Two anchor points create a Fibonacci retracement. Default levels are:

- 0;
- 0.236;
- 0.382;
- 0.5;
- 0.618;
- 0.786;
- 1.

Each level renders a horizontal line and label. Level visibility can be customized.

## Daily SVP Indicator

SVP is an automatic indicator, not a manual drawing.

When enabled, the replay determines the current daily session from the current replay candle using the Europe/Rome timezone:

- session start: 00:00 Europe/Rome;
- session end: next 00:00 Europe/Rome;
- daylight-saving transitions are respected.

The SVP calculation uses all available candles in that Europe/Rome daily session. When the replay advances into a new Europe/Rome day, the profile updates to the new day.

The SVP renders:

- horizontal volume bars grouped by price bucket;
- POC line;
- Value Area High;
- Value Area Low;
- optional subtle daily-session background boundary if it does not clutter the chart.

Default settings:

- rows: 24;
- value area: 70%;
- side: right side of the daily session range;
- opacity: low enough to keep candles readable.

If a candle has no volume value, the SVP skips that candle. If the daily session has too little usable volume data, the indicator shows no profile rather than rendering misleading values.

## Persistence

Per-session replay persistence is extended to include:

- drawing objects;
- drawing style defaults;
- SVP settings and enabled/disabled state.

Persistence remains local to the browser, keyed by the existing replay persistence key. Existing persisted replay sessions must parse safely if they do not include drawing data.

## Components and Boundaries

Recommended new modules:

- `chartDrawingTypes.ts`: drawing object and style types.
- `chartDrawingPersistence.ts`: serialize/parse drawing state safely.
- `chartDrawingGeometry.ts`: coordinate conversion helpers and hit-testing.
- `chartVolumeProfile.ts`: daily Europe/Rome session selection and SVP bucket calculations.
- `ChartDrawingOverlay.tsx`: SVG overlay renderer and pointer interaction controller.
- `ChartDrawingToolbar.tsx`: vertical toolbar and active-tool controls.
- `ChartDrawingProperties.tsx`: contextual properties panel.

`ChartReplay.tsx` should own high-level state and pass chart data, active interval, visible candles, and callbacks into the drawing modules.

## Data Flow

1. `ChartReplay` loads candles and computes replay/visible candle state.
2. `ChartReplay` passes visible candles, all candles, chart dimensions, and active interval to the overlay.
3. The overlay renders persisted drawings and, if enabled, the current Europe/Rome daily SVP.
4. User interactions create/update drawing objects in chart-domain coordinates.
5. Updated drawing state is persisted with the replay session.
6. Replay advancement or timeframe changes trigger overlay recalculation and rerendering.

## Error Handling

- Malformed persisted drawing state is ignored and replaced with an empty drawing state.
- SVP silently skips missing or invalid volume values.
- If all volume values are missing for a daily session, no SVP is rendered for that session.
- Drawing interactions should not throw if a pointer maps outside the chart bounds.

## Testing

Unit tests:

- drawing persistence accepts valid state and rejects malformed state;
- drawing geometry maps domain values consistently enough for overlay rendering;
- Fibonacci levels are generated in expected order;
- Europe/Rome daily session boundaries include the correct candles;
- SVP buckets volume by price and identifies POC/VAH/VAL;
- missing volume data is handled safely.

Component/static tests:

- `ChartReplay` exposes the drawing toolbar;
- SVP settings are included in replay persistence;
- existing replay progress and 120-candle start behavior remain covered.

Manual QA:

- draw rectangle/line/arrow/Fibonacci during replay;
- advance and rewind replay and confirm drawings stay anchored;
- change timeframe and confirm drawings remain anchored to the same timestamp and price values;
- enable SVP and confirm it updates when crossing Europe/Rome midnight;
- refresh the page and confirm drawings/settings persist.

## Open Decisions Resolved

- Toolbar layout: vertical toolbar on chart left side.
- SVP range: automatic Europe/Rome midnight-to-midnight daily session.
- Timezone: Europe/Rome.
