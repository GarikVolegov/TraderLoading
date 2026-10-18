import { useState } from 'react';
import { useUser } from '@clerk/react';
/** Failed uploads (e.g. files no longer on Railway) fall back to the identity
 * avatar, then the bundled brand asset, then initials. Never rewrite user data. */
export function ProfileAvatar({ src, alt, name, className = '' }: { src?: string|null; alt: string; name: string; className?: string }) {
  const { user }=useUser();
  const [failed,setFailed]=useState<string[]>([]);
  const candidates=[src,user?.imageUrl,`${import.meta.env.BASE_URL}images/avatar-default.webp`].filter((s):s is string=>Boolean(s));
  const current=candidates.find(s=>!failed.includes(s));
  return current ? <img src={current} alt={alt} className={className} onError={()=>setFailed(previous=>[...previous,current])} /> :
    <span role="img" aria-label={alt} className={`${className} flex items-center justify-center bg-primary/15 text-primary font-bold`}>{name.trim().slice(0,2).toUpperCase() || 'TL'}</span>;
}
