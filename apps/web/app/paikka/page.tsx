import { redirect } from 'next/navigation';

const PUBLIC_BASE_URL =
  process.env.PUBLIC_BASE_URL ?? process.env.NEXT_PUBLIC_PUBLIC_BASE_URL ?? 'https://localeffortfood.com';

const buildTarget = () => {
  try {
    return new URL('/paikka', PUBLIC_BASE_URL).toString();
  } catch (_) {
    return 'https://localeffortfood.com/paikka';
  }
};

export default function PaikkaPage() {
  redirect(buildTarget());
}
