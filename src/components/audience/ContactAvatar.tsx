import React, { useEffect, useMemo, useState } from 'react';

interface ContactAvatarProps {
    contactId: number;
    firstName?: string;
    lastName?: string;
    size?: 'sm' | 'md' | 'lg';
    className?: string;
}

const sizeClasses = {
    sm: 'h-9 w-9 text-xs',
    md: 'h-10 w-10 text-sm',
    lg: 'h-12 w-12 text-base',
};

const toneClasses = [
    'bg-indigo-50 text-indigo-600',
    'bg-cyan-50 text-cyan-700',
    'bg-emerald-50 text-emerald-700',
    'bg-amber-50 text-amber-700',
    'bg-rose-50 text-rose-600',
    'bg-violet-50 text-violet-600',
];

export default function ContactAvatar({
    contactId,
    firstName,
    lastName,
    size = 'md',
    className = '',
}: ContactAvatarProps) {
    const [loaded, setLoaded] = useState(false);
    const [failed, setFailed] = useState(false);

    useEffect(() => {
        setLoaded(false);
        setFailed(false);
    }, [contactId]);

    const initials = useMemo(() => {
        const letters = [firstName, lastName]
            .map(value => value?.trim().charAt(0).toUpperCase())
            .filter(Boolean)
            .join('');
        return letters || '?';
    }, [firstName, lastName]);

    const tone = toneClasses[Math.abs(contactId) % toneClasses.length];

    return (
        <div
            className={`relative flex shrink-0 items-center justify-center overflow-hidden rounded-full font-medium ${sizeClasses[size]} ${tone} ${className}`}
            aria-label={`Контакт ${[firstName, lastName].filter(Boolean).join(' ') || contactId}`}
        >
            <span aria-hidden="true">{initials}</span>
            {!failed && (
                <img
                    src={`/api/subscribers/${encodeURIComponent(String(contactId))}/avatar`}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    onLoad={() => setLoaded(true)}
                    onError={() => setFailed(true)}
                    className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-150 ${loaded ? 'opacity-100' : 'opacity-0'}`}
                />
            )}
        </div>
    );
}
