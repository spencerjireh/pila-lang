"use client";

import { useId } from "react";
import { Input } from "@/components/ui/input";
import { IANA_TIMEZONES } from "@pila/shared/primitives/timezones";

export interface TimezoneInputProps {
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  id?: string;
  name?: string;
}

export function TimezoneInput({
  value,
  onChange,
  required,
  id: providedId,
  name,
}: TimezoneInputProps) {
  const autoId = useId();
  const id = providedId ?? autoId;
  const listId = `${id}-list`;
  return (
    <>
      <Input
        id={id}
        name={name}
        list={listId}
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Asia/Kolkata"
      />
      <datalist id={listId}>
        {IANA_TIMEZONES.map((tz) => (
          <option key={tz} value={tz} />
        ))}
      </datalist>
    </>
  );
}
