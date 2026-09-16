import { useState } from 'react'
import type { FormEvent } from 'react'
import { ChevronDownIcon, CircleAlertIcon, Trash2Icon } from 'lucide-react'
import { ConfirmButton } from '@/components/confirm-button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { useRouteAction } from '@/hooks/use-route-action'
import { personName } from '@/lib/auth/display-user'
import { formatDay, today } from '@/lib/format'
import { addTask, removeTask, setTaskCompleted, type Task } from '@/lib/supabase/crm'
import type { PlatformMember } from '@/lib/supabase/platform'
import { cn } from '@/lib/utils'

type TasksSectionProps = {
  orgId: string
  tasks: Task[]
  staff: PlatformMember[]
  currentUserId: string
  /** Whether the viewer may add and complete tasks (every staff tier). */
  canLog: boolean
  /** Whether the viewer may remove anyone's task (superadmin, admin). */
  canManage: boolean
}

/** Follow-ups about this customer: open ones first, completed ones tucked away. */
export const TasksSection = ({
  orgId,
  tasks,
  staff,
  currentUserId,
  canLog,
  canManage,
}: TasksSectionProps) => {
  const { busy, error, run } = useRouteAction()
  const [title, setTitle] = useState('')
  const [dueOn, setDueOn] = useState('')
  const [assignedTo, setAssignedTo] = useState(currentUserId)

  const open = tasks.filter((task) => !task.completed_at)
  const done = tasks.filter((task) => task.completed_at)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!title.trim()) return
    const ok = await run('add', () =>
      addTask(orgId, { title, due_on: dueOn || null, assigned_to: assignedTo || null }),
    )
    if (ok) {
      setTitle('')
      setDueOn('')
    }
  }

  const row = (task: Task) => (
    <TaskRow
      key={task.id}
      task={task}
      disabled={!canLog || busy !== null}
      canRemove={canManage || task.created_by === currentUserId}
      onToggle={(completed) => void run(task.id, () => setTaskCompleted(task.id, completed))}
      onRemove={() => void run(task.id, () => removeTask(task.id))}
    />
  )

  return (
    <section aria-labelledby="tasks-heading" className="flex flex-col gap-3">
      <h2 id="tasks-heading" className="text-base font-medium">
        Tasks
      </h2>

      {error ? (
        <Alert variant="destructive">
          <CircleAlertIcon className="size-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {open.length === 0 ? (
        <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
          No open tasks.
        </p>
      ) : (
        <ul className="flex flex-col divide-y rounded-xl border">{open.map(row)}</ul>
      )}

      {canLog ? (
        <form onSubmit={handleSubmit} className="rounded-xl border bg-card p-4">
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="task-title">New task</FieldLabel>
              <Input
                id="task-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Send the proposal"
                maxLength={200}
                autoComplete="off"
                required
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="task-due">Due</FieldLabel>
                <Input
                  id="task-due"
                  type="date"
                  value={dueOn}
                  onChange={(event) => setDueOn(event.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="task-assignee">Assigned to</FieldLabel>
                <NativeSelect
                  id="task-assignee"
                  value={assignedTo}
                  onChange={(event) => setAssignedTo(event.target.value)}
                  className="w-full"
                >
                  <NativeSelectOption value="">Unassigned</NativeSelectOption>
                  {staff.map((member) => (
                    <NativeSelectOption key={member.user_id} value={member.user_id}>
                      {personName(member.profile)}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </Field>
            </div>
            <Field orientation="horizontal">
              <Button type="submit" size="sm" disabled={busy !== null || !title.trim()}>
                {busy === 'add' ? 'Adding…' : 'Add task'}
              </Button>
            </Field>
          </FieldGroup>
        </form>
      ) : null}

      {done.length > 0 ? (
        <Collapsible>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="group/done self-start">
              <ChevronDownIcon
                data-icon="inline-start"
                className="transition-transform group-data-[state=open]/done:rotate-180"
              />
              Completed ({done.length})
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <ul className="mt-2 flex flex-col divide-y rounded-xl border">{done.map(row)}</ul>
          </CollapsibleContent>
        </Collapsible>
      ) : null}
    </section>
  )
}

type TaskRowProps = {
  task: Task
  disabled: boolean
  canRemove: boolean
  onToggle: (completed: boolean) => void
  onRemove: () => void
}

const TaskRow = ({ task, disabled, canRemove, onToggle, onRemove }: TaskRowProps) => {
  const completed = task.completed_at !== null
  const overdue = !completed && task.due_on !== null && task.due_on < today()
  const checkboxId = `task-${task.id}`

  return (
    <li className="flex items-center gap-3 p-3">
      <Checkbox
        id={checkboxId}
        checked={completed}
        disabled={disabled}
        onCheckedChange={(checked) => onToggle(checked === true)}
        aria-label={`${completed ? 'Reopen' : 'Complete'} ${task.title}`}
      />
      <label
        htmlFor={checkboxId}
        className={cn('min-w-0 flex-1 text-sm', completed && 'text-muted-foreground line-through')}
      >
        {task.title}
      </label>
      <span className="flex shrink-0 items-center gap-3 text-xs text-muted-foreground">
        {task.due_on ? (
          <time
            dateTime={task.due_on}
            className={cn(overdue && 'font-medium text-destructive')}
            title={overdue ? 'Overdue' : undefined}
          >
            {overdue ? 'Overdue · ' : ''}
            {formatDay(task.due_on)}
          </time>
        ) : null}
        <span>{task.assignee ? personName(task.assignee) : 'Unassigned'}</span>
      </span>
      {canRemove ? (
        <ConfirmButton
          variant="ghost"
          size="icon-sm"
          disabled={disabled}
          aria-label={`Remove task ${task.title}`}
          title={`Remove “${task.title}”?`}
          actionLabel="Remove"
          onConfirm={onRemove}
        >
          <Trash2Icon />
        </ConfirmButton>
      ) : null}
    </li>
  )
}
