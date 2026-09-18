import { Checkbox } from '@/components/ui/checkbox'
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import type { CustomerField, FieldErrors, FieldFormValues } from '@/features/crm/fields'

type DetailsFieldsProps = {
  fields: readonly CustomerField[]
  values: FieldFormValues
  errors?: FieldErrors
  onChange: (key: string, value: FieldFormValues[string]) => void
  /** Prefix for element ids, so two forms on one page do not collide. */
  idPrefix: string
  disabled?: boolean
}

/**
 * The product's customer fields as inputs, one per field, in the schema's order. Owns no
 * state: the form around it does, and decides when to save.
 */
export const DetailsFields = ({
  fields,
  values,
  errors = {},
  onChange,
  idPrefix,
  disabled = false,
}: DetailsFieldsProps) => (
  <>
    {fields.map((field) => {
      const id = `${idPrefix}-${field.key}`
      const error = errors[field.key]
      const value = values[field.key]
      const invalid = error ? { 'aria-invalid': true as const } : {}

      switch (field.type) {
        case 'text':
          return (
            <Field key={field.key} data-invalid={Boolean(error) || undefined}>
              <FieldLabel htmlFor={id}>{field.label}</FieldLabel>
              <Input
                id={id}
                type="text"
                value={typeof value === 'string' ? value : ''}
                onChange={(event) => onChange(field.key, event.target.value)}
                placeholder={field.placeholder}
                maxLength={field.maxLength}
                disabled={disabled}
                {...invalid}
              />
              {field.help ? <FieldDescription>{field.help}</FieldDescription> : null}
              {error ? <FieldError>{error}</FieldError> : null}
            </Field>
          )
        case 'number':
          return (
            <Field key={field.key} data-invalid={Boolean(error) || undefined}>
              <FieldLabel htmlFor={id}>
                {field.label}
                {field.unit ? ` (${field.unit})` : ''}
              </FieldLabel>
              <Input
                id={id}
                type="number"
                inputMode="numeric"
                value={typeof value === 'string' ? value : ''}
                onChange={(event) => onChange(field.key, event.target.value)}
                min={field.min}
                max={field.max}
                disabled={disabled}
                {...invalid}
              />
              {field.help ? <FieldDescription>{field.help}</FieldDescription> : null}
              {error ? <FieldError>{error}</FieldError> : null}
            </Field>
          )
        case 'select':
          return (
            <Field key={field.key} data-invalid={Boolean(error) || undefined}>
              <FieldLabel htmlFor={id}>{field.label}</FieldLabel>
              <NativeSelect
                id={id}
                value={typeof value === 'string' ? value : ''}
                onChange={(event) => onChange(field.key, event.target.value)}
                disabled={disabled}
                className="w-full"
                {...invalid}
              >
                <NativeSelectOption value="">—</NativeSelectOption>
                {field.options.map((option) => (
                  <NativeSelectOption key={option.value} value={option.value}>
                    {option.label}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
              {field.help ? <FieldDescription>{field.help}</FieldDescription> : null}
              {error ? <FieldError>{error}</FieldError> : null}
            </Field>
          )
        case 'multiselect': {
          const chosen = Array.isArray(value) ? value : []
          return (
            <fieldset key={field.key} className="flex flex-col gap-2">
              <legend className="text-sm font-medium">{field.label}</legend>
              {field.options.map((option) => {
                const optionId = `${id}-${option.value}`
                return (
                  <div key={option.value} className="flex items-center gap-2">
                    <Checkbox
                      id={optionId}
                      checked={chosen.includes(option.value)}
                      onCheckedChange={(checked) =>
                        onChange(
                          field.key,
                          checked === true
                            ? [...chosen, option.value]
                            : chosen.filter((item) => item !== option.value),
                        )
                      }
                      disabled={disabled}
                    />
                    <Label htmlFor={optionId} className="font-normal">
                      {option.label}
                    </Label>
                  </div>
                )
              })}
              {field.help ? <FieldDescription>{field.help}</FieldDescription> : null}
              {error ? <FieldError>{error}</FieldError> : null}
            </fieldset>
          )
        }
        case 'boolean':
          return (
            <div key={field.key} className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <Checkbox
                  id={id}
                  checked={value === true}
                  onCheckedChange={(checked) => onChange(field.key, checked === true)}
                  disabled={disabled}
                />
                <Label htmlFor={id}>{field.label}</Label>
              </div>
              {field.help ? <FieldDescription>{field.help}</FieldDescription> : null}
            </div>
          )
      }
    })}
  </>
)
