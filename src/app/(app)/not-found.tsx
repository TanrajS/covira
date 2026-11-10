import { ButtonLink } from "@/components/ui";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-md py-20 text-center">
      <h1 className="text-xl font-semibold">Not found</h1>
      <p className="mt-2 text-slate-500">This record doesn&apos;t exist or isn&apos;t in your book of business.</p>
      <ButtonLink href="/clients" className="mt-6">Back to clients</ButtonLink>
    </div>
  );
}
