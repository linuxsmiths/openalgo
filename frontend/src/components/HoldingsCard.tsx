import { Link } from 'react-router-dom'
import { TrendingUp } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface HoldingsCardProps {
  totalValue: number
  totalPnL: number
  holdingCount: number
  isLoading?: boolean
}

function formatIndianNumber(value: number): string {
  if (Number.isNaN(value)) return '0.00'

  const isNegative = value < 0
  const absNum = Math.abs(value)

  let formatted: string
  if (absNum >= 10000000) {
    formatted = `${(absNum / 10000000).toFixed(2)}Cr`
  } else if (absNum >= 100000) {
    formatted = `${(absNum / 100000).toFixed(2)}L`
  } else {
    formatted = absNum.toFixed(2)
  }

  return isNegative ? `-${formatted}` : formatted
}

function getPnLColor(value: number): string {
  if (value > 0) return 'text-green-600 dark:text-green-400'
  if (value < 0) return 'text-red-600 dark:text-red-400'
  return 'text-foreground'
}

function getPnLBadgeVariant(value: number): 'default' | 'destructive' | 'secondary' {
  if (value > 0) return 'default'
  if (value < 0) return 'destructive'
  return 'secondary'
}

export default function HoldingsCard({
  totalValue,
  totalPnL,
  holdingCount,
  isLoading = false,
}: HoldingsCardProps) {
  if (holdingCount === 0 && !isLoading) {
    return (
      <Link to="/holdings" className="block cursor-pointer">
        <Card className="hover:border-primary/40 transition-all hover:shadow-md">
          <CardContent className="pt-6">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Holdings Portfolio</p>
              <p className="text-2xl font-bold text-muted-foreground">No Holdings</p>
              <Badge variant="secondary" className="mt-2">
                Empty Portfolio
              </Badge>
            </div>
          </CardContent>
        </Card>
      </Link>
    )
  }

  return (
    <Link to="/holdings" className="block cursor-pointer">
      <Card className="hover:border-primary/40 transition-all hover:shadow-md">
        <CardContent className="pt-6">
          <div className="space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Holdings Portfolio</p>
                <p className="text-2xl font-bold text-primary">
                  {isLoading ? '...' : formatIndianNumber(totalValue)}
                </p>
              </div>
              <TrendingUp className="h-5 w-5 text-primary/60" />
            </div>

            <div className="pt-2 border-t space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-xs text-muted-foreground">P&L</span>
                <p className={cn('font-bold text-sm', getPnLColor(totalPnL))}>
                  {isLoading ? '...' : formatIndianNumber(totalPnL)}
                </p>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-muted-foreground">Holdings</span>
                <Badge variant="outline" className="text-xs">
                  {isLoading ? '...' : `${holdingCount}`}
                </Badge>
              </div>
            </div>

            <Badge
              variant={getPnLBadgeVariant(totalPnL)}
              className="mt-2 w-full justify-center"
            >
              {totalPnL > 0 ? 'Gain' : totalPnL < 0 ? 'Loss' : 'Neutral'}
            </Badge>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
