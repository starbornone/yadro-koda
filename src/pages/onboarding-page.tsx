import { AuthLayout } from '@/features/auth/components/auth-layout'
import { CreateOrganisationForm } from '@/features/organisations/components/create-organisation-form'
import { useCreateOrganisation } from '@/features/organisations/hooks/use-create-organisation'

/** First stop after sign-up: a user needs an organisation before they can enter the app. */
export const OnboardingPage = () => {
  const form = useCreateOrganisation()

  return (
    <AuthLayout>
      <CreateOrganisationForm
        name={form.name}
        slug={form.slug}
        loading={form.loading}
        error={form.error}
        onNameChange={form.setName}
        onSlugChange={form.setSlug}
        onSubmit={form.handleSubmit}
      />
    </AuthLayout>
  )
}
