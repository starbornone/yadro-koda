import { PageHeader } from '@/components/layout/page-header'
import { CreateOrganisationForm } from '@/features/organisations/components/create-organisation-form'
import { useCreateOrganisation } from '@/features/organisations/hooks/use-create-organisation'

/** Same form as onboarding, inside the app shell, for users who already belong somewhere. */
export const NewOrganisationPage = () => {
  const form = useCreateOrganisation()

  return (
    <>
      <PageHeader crumbs={[{ label: 'Dashboard', to: '/app' }, { label: 'New organisation' }]} />
      <div className="flex flex-1 flex-col p-4 md:p-6">
        <div className="mx-auto w-full max-w-md py-8">
          <CreateOrganisationForm
            title="New organisation"
            description="It becomes your active organisation once created."
            name={form.name}
            slug={form.slug}
            loading={form.loading}
            error={form.error}
            onNameChange={form.setName}
            onSlugChange={form.setSlug}
            onSubmit={form.handleSubmit}
          />
        </div>
      </div>
    </>
  )
}
