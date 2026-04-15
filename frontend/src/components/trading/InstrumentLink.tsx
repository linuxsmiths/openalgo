import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { tradingApi, type SymbolInfoData } from '@/api/trading'
import { useLiveQuote, type LiveQuoteData } from '@/hooks/useLiveQuote'
import { useIsMobile } from '@/hooks/use-mobile'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/authStore'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { MarketDepthPanel } from './MarketDepthPanel'
import { PlaceOrderDialog } from './PlaceOrderDialog'
import { QuoteHeader } from './QuoteHeader'

export interface InstrumentLinkProps {
  symbol: string
  exchange: string
  children?: ReactNode
  className?: string
  lotSize?: number
  tickSize?: number
  week52High?: number
  week52Low?: number
}

function formatPrice(value?: number): string {
  return value !== undefined && value > 0 ? `Rs ${value.toFixed(2)}` : '--'
}

function formatCompactNumber(value?: number): string {
  if (value === undefined || value === null) return '--'
  return new Intl.NumberFormat('en-IN', {
    notation: 'compact',
    maximumFractionDigits: 2,
  }).format(value)
}

function toFiniteNumber(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return fallback
}

function hasFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function getRangePosition(low?: number, high?: number, current?: number): number | null {
  if (!hasFiniteNumber(low) || !hasFiniteNumber(high) || !hasFiniteNumber(current) || high <= low) {
    return null
  }

  const percentage = ((current - low) / (high - low)) * 100
  return Math.min(Math.max(percentage, 0), 100)
}

function DetailStat({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="rounded-md border bg-muted/20 px-3 py-2">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm font-medium">{value}</div>
    </div>
  )
}

function PriceRangeBar({
  label,
  low,
  high,
  current,
}: {
  label: string
  low?: number
  high?: number
  current?: number
}) {
  const hasRange = hasFiniteNumber(low) && hasFiniteNumber(high) && high > low
  const markerPosition = getRangePosition(low, high, current)

  return (
    <div className="rounded-md border bg-muted/20 px-3 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className="text-right">
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">LTP</div>
          <div className="text-sm font-medium">{formatPrice(current)}</div>
        </div>
      </div>

      <div className="mt-3">
        <div className="relative h-2 rounded-full bg-muted">
          {hasRange ? (
            <div className="absolute inset-0 rounded-full bg-gradient-to-r from-rose-500 via-amber-400 to-emerald-500" />
          ) : (
            <div className="absolute inset-0 rounded-full border border-dashed border-muted-foreground/40" />
          )}

          {markerPosition !== null ? (
            <div
              className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-background bg-primary shadow-sm"
              style={{ left: `${markerPosition}%` }}
            />
          ) : null}
        </div>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] text-muted-foreground">
        <div>
          <div>Low</div>
          <div className="text-sm font-medium text-foreground/90">{formatPrice(low)}</div>
        </div>
        <div className="text-right">
          <div>High</div>
          <div className="text-sm font-medium text-foreground/90">{formatPrice(high)}</div>
        </div>
      </div>
    </div>
  )
}

function InstrumentQuickViewPanel({
  symbol,
  exchange,
  apiKey,
  metadata,
  liveData,
  isLoading,
  isDepthExpanded,
  onToggleDepth,
  onOrderAction,
  providedWeek52High,
  providedWeek52Low,
  className,
  style,
}: {
  symbol: string
  exchange: string
  apiKey: string | null
  metadata?: SymbolInfoData
  liveData: LiveQuoteData
  isLoading: boolean
  isDepthExpanded: boolean
  onToggleDepth: () => void
  onOrderAction: (action: 'BUY' | 'SELL') => void
  providedWeek52High?: number
  providedWeek52Low?: number
  className?: string
  style?: CSSProperties
}) {
  const week52High = liveData.week52High ?? providedWeek52High
  const week52Low = liveData.week52Low ?? providedWeek52Low

  return (
    <div className={cn('flex min-h-0 flex-col overflow-hidden', className)} style={style}>
      <div className="shrink-0 border-b px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-base font-semibold">{symbol}</div>
            {metadata?.name ? (
              <div className="line-clamp-2 text-xs text-muted-foreground">{metadata.name}</div>
            ) : null}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Badge variant="outline">{exchange}</Badge>
            {metadata?.instrumenttype ? (
              <Badge variant="secondary">{metadata.instrumenttype}</Badge>
            ) : null}
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 py-4">
        <QuoteHeader
          exchange={exchange}
          ltp={liveData.ltp}
          prevClose={liveData.close}
          change={liveData.change}
          changePercent={liveData.changePercent}
          bidPrice={liveData.bidPrice}
          askPrice={liveData.askPrice}
          bidSize={liveData.bidSize}
          askSize={liveData.askSize}
          isLoading={isLoading}
        />

        <div className="space-y-3">
          <PriceRangeBar
            label="Day Range"
            low={liveData.low}
            high={liveData.high}
            current={liveData.ltp}
          />
          <PriceRangeBar
            label="52W Range"
            low={week52Low}
            high={week52High}
            current={liveData.ltp}
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <DetailStat label="Open" value={formatPrice(liveData.open)} />
          <DetailStat label="Prev Close" value={formatPrice(liveData.close)} />
          <DetailStat label="Volume" value={formatCompactNumber(liveData.volume)} />
          <DetailStat
            label="Lot / Tick"
            value={`${toFiniteNumber(metadata?.lotsize, 1)} / ${toFiniteNumber(metadata?.tick_size, 0.05)}`}
          />
        </div>

        <MarketDepthPanel
          depth={liveData.depth}
          isExpanded={isDepthExpanded}
          onToggle={onToggleDepth}
        />
      </div>

      <div className="shrink-0 border-t bg-background px-4 py-4">
        <div className="grid grid-cols-2 gap-2">
          <Button
            className="bg-green-600 hover:bg-green-700"
            onClick={() => onOrderAction('BUY')}
            disabled={!apiKey}
          >
            Buy
          </Button>
          <Button
            variant="destructive"
            onClick={() => onOrderAction('SELL')}
            disabled={!apiKey}
          >
            Sell
          </Button>
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">
          Opens the standard order ticket with Market, Limit, SL, and SL-M support.
        </p>
      </div>
    </div>
  )
}

export function InstrumentLink({
  symbol,
  exchange,
  children,
  className,
  lotSize,
  tickSize,
  week52High,
  week52Low,
}: InstrumentLinkProps) {
  const isMobile = useIsMobile()
  const { apiKey } = useAuthStore()
  const [open, setOpen] = useState(false)
  const [isDepthExpanded, setIsDepthExpanded] = useState(true)
  const [orderDialogOpen, setOrderDialogOpen] = useState(false)
  const [orderAction, setOrderAction] = useState<'BUY' | 'SELL'>('BUY')

  const symbolInfoQuery = useQuery({
    queryKey: ['symbol-info', apiKey, exchange, symbol],
    enabled: open && !!apiKey,
    queryFn: async () => tradingApi.getSymbolInfo(apiKey as string, symbol, exchange),
  })

  const symbolInfo = useMemo(
    () => (symbolInfoQuery.data?.status === 'success' ? symbolInfoQuery.data.data : undefined),
    [symbolInfoQuery.data]
  )

  const liveQuote = useLiveQuote(symbol, exchange, {
    enabled: open && !!apiKey,
    mode: 'Depth',
    useQuotesFallback: true,
    useDepthFallback: true,
  })

  useEffect(() => {
    if (open) {
      setIsDepthExpanded(true)
    }
  }, [open])

  const displayLotSize = toFiniteNumber(symbolInfo?.lotsize ?? lotSize, 1)
  const displayTickSize = toFiniteNumber(symbolInfo?.tick_size ?? tickSize, 0.05)
  const displayQuantity = Math.max(displayLotSize, 1)

  const handleOrderAction = (action: 'BUY' | 'SELL') => {
    setOrderAction(action)
    setOpen(false)
    setOrderDialogOpen(true)
  }

  const trigger = (
    <button
      type="button"
      className={cn(
        'inline-flex items-center bg-transparent p-0 text-left text-inherit underline-offset-4 hover:underline focus:outline-none',
        className
      )}
      onClick={(event) => event.stopPropagation()}
    >
      {children ?? symbol}
    </button>
  )

  const panel = (
    <InstrumentQuickViewPanel
      symbol={symbol}
      exchange={exchange}
      apiKey={apiKey}
      metadata={symbolInfo}
      liveData={liveQuote.data}
      isLoading={symbolInfoQuery.isLoading && liveQuote.data.ltp === undefined}
      isDepthExpanded={isDepthExpanded}
      onToggleDepth={() => setIsDepthExpanded((current) => !current)}
      onOrderAction={handleOrderAction}
      providedWeek52High={week52High}
      providedWeek52Low={week52Low}
      className={isMobile ? 'flex-1' : undefined}
      style={
        isMobile
          ? undefined
          : {
              maxHeight:
                'min(36rem, calc(100dvh - 2rem), var(--radix-popover-content-available-height))',
            }
      }
    />
  )

  return (
    <>
      {isMobile ? (
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>{trigger}</SheetTrigger>
          <SheetContent
            side="bottom"
            className="flex h-[85dvh] max-h-[85dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-none"
          >
            <SheetHeader className="border-b px-4 py-3 text-left">
              <SheetTitle>{symbol}</SheetTitle>
              <SheetDescription>{exchange} instrument quick view</SheetDescription>
            </SheetHeader>
            {panel}
          </SheetContent>
        </Sheet>
      ) : (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>{trigger}</PopoverTrigger>
          <PopoverContent
            align="start"
            sticky="always"
            collisionPadding={16}
            className="w-[calc(100vw-2rem)] max-w-[420px] overflow-hidden p-0"
          >
            {panel}
          </PopoverContent>
        </Popover>
      )}

      <PlaceOrderDialog
        open={orderDialogOpen}
        onOpenChange={setOrderDialogOpen}
        symbol={symbol}
        exchange={exchange}
        action={orderAction}
        quantity={displayQuantity}
        lotSize={displayLotSize}
        tickSize={displayTickSize}
        strategy="InstrumentQuickView"
      />
    </>
  )
}
