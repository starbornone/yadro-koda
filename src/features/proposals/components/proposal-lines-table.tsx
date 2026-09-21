import type { ReactNode } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { PRICE_BOOK_KIND_SUFFIX } from '@/features/proposals/labels'
import { formatMoney } from '@/lib/format'
import type { PriceBookKind } from '@/lib/supabase/proposals'

export type LineLike = {
  id?: string
  description: string
  kind: PriceBookKind
  quantity: number
  unit_amount: number
}

type ProposalLinesTableProps = {
  lines: LineLike[]
  total: number
  annual: number
  /** Rendered at the end of each row, e.g. edit and remove buttons. */
  actions?: (line: LineLike, index: number) => ReactNode
  /** Rendered as the last body row, e.g. an add-line form. */
  footerRow?: ReactNode
}

/** A proposal's lines as both staff and the recipient read them: what, how many, at what, and the totals. */
export const ProposalLinesTable = ({
  lines,
  total,
  annual,
  actions,
  footerRow,
}: ProposalLinesTableProps) => (
  <div className="overflow-x-auto rounded-xl border">
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Item</TableHead>
          <TableHead className="text-right">Quantity</TableHead>
          <TableHead className="text-right">Unit price</TableHead>
          <TableHead className="text-right">Amount</TableHead>
          {actions ? <TableHead className="w-0" /> : null}
        </TableRow>
      </TableHeader>
      <TableBody>
        {lines.length === 0 ? (
          <TableRow>
            <TableCell colSpan={actions ? 5 : 4} className="text-center text-muted-foreground">
              No lines yet.
            </TableCell>
          </TableRow>
        ) : (
          lines.map((line, index) => (
            <TableRow key={line.id ?? index}>
              <TableCell className="font-medium">{line.description}</TableCell>
              <TableCell className="text-right tabular-nums">{line.quantity}</TableCell>
              <TableCell className="text-right tabular-nums text-muted-foreground">
                {formatMoney(line.unit_amount)}
                {PRICE_BOOK_KIND_SUFFIX[line.kind]}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {formatMoney(line.quantity * line.unit_amount)}
                {PRICE_BOOK_KIND_SUFFIX[line.kind]}
              </TableCell>
              {actions ? <TableCell>{actions(line, index)}</TableCell> : null}
            </TableRow>
          ))
        )}
        {footerRow}
      </TableBody>
      <TableFooter>
        <TableRow>
          <TableCell colSpan={3}>Total on this proposal</TableCell>
          <TableCell className="text-right tabular-nums">{formatMoney(total)}</TableCell>
          {actions ? <TableCell /> : null}
        </TableRow>
        <TableRow>
          <TableCell colSpan={3} className="font-normal text-muted-foreground">
            Recurring, per year
          </TableCell>
          <TableCell className="text-right tabular-nums font-normal text-muted-foreground">
            {formatMoney(annual)}
          </TableCell>
          {actions ? <TableCell /> : null}
        </TableRow>
      </TableFooter>
    </Table>
  </div>
)
