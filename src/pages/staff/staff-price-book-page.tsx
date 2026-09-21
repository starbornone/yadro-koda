import { useState } from 'react'
import type { FormEvent } from 'react'
import { getRouteApi } from '@tanstack/react-router'
import {
  ArchiveIcon,
  ArchiveRestoreIcon,
  CircleAlertIcon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
} from 'lucide-react'
import { ConfirmButton } from '@/components/confirm-button'
import { PageHeader } from '@/components/layout/page-header'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { PRICE_BOOK_KIND_LABELS, PRICE_BOOK_KIND_SUFFIX } from '@/features/proposals/labels'
import { useRouteAction } from '@/hooks/use-route-action'
import { canOnPlatform } from '@/lib/auth/permissions'
import { staffRoute } from '@/lib/auth/staff-route'
import { formatMoney } from '@/lib/format'
import { normaliseSlugInput } from '@/lib/supabase/organisations'
import {
  PRICE_BOOK_KINDS,
  createPriceBookItem,
  deletePriceBookItem,
  setPriceBookItemActive,
  updatePriceBookItem,
  type PriceBookItem,
  type PriceBookItemInput,
} from '@/lib/supabase/proposals'

const route = getRouteApi('/_authenticated/_staff/staff/price-book')

/**
 * What can be sold: the product's plans and add-ons, each with a unit price and how it recurs.
 * Proposals are built from these; retiring an item hides it from new proposals without
 * touching the ones that used it.
 */
export const StaffPriceBookPage = () => {
  const items = route.useLoaderData()
  const { platformRole } = staffRoute.useLoaderData()
  const { busy, error, run } = useRouteAction()
  // 'new' for the add form, an item id for its edit form, null for neither.
  const [editing, setEditing] = useState<'new' | string | null>(null)

  const canManage = canOnPlatform(platformRole, 'platform:manage-customers')

  const save = async (input: PriceBookItemInput, itemId?: string) => {
    const ok = await run(itemId ?? 'new', () =>
      itemId ? updatePriceBookItem(itemId, input) : createPriceBookItem(input),
    )
    if (ok) setEditing(null)
  }

  return (
    <>
      <PageHeader crumbs={[{ label: 'Staff', to: '/staff' }, { label: 'Price book' }]} />
      <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Price book</h1>
            <p className="text-muted-foreground">
              What goes on a proposal: plans, add-ons and services, with a unit price.
            </p>
          </div>
          {canManage && editing !== 'new' ? (
            <Button onClick={() => setEditing('new')}>
              <PlusIcon data-icon="inline-start" />
              New item
            </Button>
          ) : null}
        </div>

        {error ? (
          <Alert variant="destructive">
            <CircleAlertIcon className="size-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        {editing === 'new' ? (
          <PriceBookItemForm
            initial={{
              code: '',
              name: '',
              description: null,
              kind: 'annual',
              unit_amount: 0,
              active: true,
              position: items.length,
            }}
            saving={busy === 'new'}
            onSave={(input) => void save(input)}
            onCancel={() => setEditing(null)}
          />
        ) : null}

        {items.length === 0 && editing !== 'new' ? (
          <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
            Nothing in the price book yet.
            {canManage ? ' Add the product’s plans and add-ons to start proposing.' : ''}
          </p>
        ) : items.length > 0 ? (
          <div className="overflow-x-auto rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Recurs</TableHead>
                  <TableHead className="text-right">Unit price</TableHead>
                  {canManage ? <TableHead className="w-0" /> : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) =>
                  editing === item.id ? (
                    <TableRow key={item.id}>
                      <TableCell colSpan={canManage ? 5 : 4}>
                        <PriceBookItemForm
                          initial={item}
                          saving={busy === item.id}
                          onSave={(input) => void save(input, item.id)}
                          onCancel={() => setEditing(null)}
                        />
                      </TableCell>
                    </TableRow>
                  ) : (
                    <TableRow key={item.id} className={item.active ? undefined : 'opacity-60'}>
                      <TableCell>
                        <span className="flex items-center gap-2 font-medium">
                          {item.name}
                          {!item.active ? <Badge variant="outline">Retired</Badge> : null}
                        </span>
                        {item.description ? (
                          <span className="block text-xs font-normal text-muted-foreground">
                            {item.description}
                          </span>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{item.code}</TableCell>
                      <TableCell>{PRICE_BOOK_KIND_LABELS[item.kind]}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatMoney(item.unit_amount)}
                        {PRICE_BOOK_KIND_SUFFIX[item.kind]}
                      </TableCell>
                      {canManage ? (
                        <TableCell>
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              disabled={busy !== null}
                              aria-label={`Edit ${item.name}`}
                              onClick={() => setEditing(item.id)}
                            >
                              <PencilIcon />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              disabled={busy !== null}
                              aria-label={`${item.active ? 'Retire' : 'Restore'} ${item.name}`}
                              onClick={() =>
                                void run(item.id, () =>
                                  setPriceBookItemActive(item.id, !item.active),
                                )
                              }
                            >
                              {item.active ? <ArchiveIcon /> : <ArchiveRestoreIcon />}
                            </Button>
                            <ConfirmButton
                              variant="ghost"
                              size="icon-sm"
                              disabled={busy !== null}
                              aria-label={`Delete ${item.name}`}
                              title={`Delete ${item.name}?`}
                              description="Proposals that used it keep their lines. To stop offering it without deleting, retire it instead."
                              actionLabel="Delete"
                              onConfirm={() =>
                                void run(item.id, () => deletePriceBookItem(item.id))
                              }
                            >
                              <Trash2Icon />
                            </ConfirmButton>
                          </div>
                        </TableCell>
                      ) : null}
                    </TableRow>
                  ),
                )}
              </TableBody>
            </Table>
          </div>
        ) : null}
      </div>
    </>
  )
}

type PriceBookItemFormProps = {
  initial: PriceBookItemInput
  saving: boolean
  onSave: (input: PriceBookItemInput) => void
  onCancel: () => void
}

const PriceBookItemForm = ({ initial, saving, onSave, onCancel }: PriceBookItemFormProps) => {
  const [name, setNameValue] = useState(initial.name)
  const [code, setCodeValue] = useState(initial.code)
  const [codeEdited, setCodeEdited] = useState(initial.code !== '')
  const [description, setDescription] = useState(initial.description ?? '')
  const [kind, setKind] = useState(initial.kind)
  const [unitAmount, setUnitAmount] = useState(String(initial.unit_amount))
  const [position, setPosition] = useState(String(initial.position))
  const [active, setActive] = useState(initial.active)

  const setName = (value: string) => {
    setNameValue(value)
    if (!codeEdited) setCodeValue(normaliseSlugInput(value))
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    onSave({
      name,
      code: code.replace(/-+$/, ''),
      description,
      kind,
      unit_amount: Number(unitAmount),
      position: Number(position) || 0,
      active,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border bg-card p-4">
      <FieldGroup>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="item-name">Name</FieldLabel>
            <Input
              id="item-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={100}
              autoComplete="off"
              required
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="item-code">Code</FieldLabel>
            <Input
              id="item-code"
              value={code}
              onChange={(event) => {
                setCodeEdited(true)
                setCodeValue(normaliseSlugInput(event.target.value))
              }}
              minLength={2}
              maxLength={50}
              pattern="[a-z0-9]+(-[a-z0-9]+)*"
              autoComplete="off"
              spellCheck={false}
              required
            />
            <FieldDescription>A short handle, unique in the book.</FieldDescription>
          </Field>
          <Field className="sm:col-span-2">
            <FieldLabel htmlFor="item-description">Description</FieldLabel>
            <Input
              id="item-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              maxLength={500}
              autoComplete="off"
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="item-kind">Recurs</FieldLabel>
            <NativeSelect
              id="item-kind"
              value={kind}
              onChange={(event) => setKind(event.target.value as PriceBookItem['kind'])}
              className="w-full"
            >
              {PRICE_BOOK_KINDS.map((option) => (
                <NativeSelectOption key={option} value={option}>
                  {PRICE_BOOK_KIND_LABELS[option]}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
          <Field>
            <FieldLabel htmlFor="item-price">Unit price</FieldLabel>
            <Input
              id="item-price"
              type="number"
              inputMode="decimal"
              min={0}
              step="0.01"
              value={unitAmount}
              onChange={(event) => setUnitAmount(event.target.value)}
              required
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="item-position">Position</FieldLabel>
            <Input
              id="item-position"
              type="number"
              min={0}
              step={1}
              value={position}
              onChange={(event) => setPosition(event.target.value)}
            />
            <FieldDescription>Lower comes first in lists.</FieldDescription>
          </Field>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox
            id="item-active"
            checked={active}
            onCheckedChange={(checked) => setActive(checked === true)}
          />
          <Label htmlFor="item-active">Offered on new proposals</Label>
        </div>
        <Field orientation="horizontal">
          <Button type="submit" size="sm" disabled={saving}>
            {saving ? 'Saving…' : 'Save item'}
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
        </Field>
      </FieldGroup>
    </form>
  )
}
