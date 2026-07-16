import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"

import { cn } from "@/src/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        "h-11 w-full min-w-0 rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2 text-base font-medium text-gray-900 transition-all outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-gray-400 placeholder:font-normal focus-visible:border-teal-500 focus-visible:ring-4 focus-visible:ring-teal-500/10 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-gray-100 disabled:opacity-50 aria-invalid:border-red-500 aria-invalid:ring-4 aria-invalid:ring-red-500/20 md:text-sm shadow-sm",
        className
      )}
      {...props}
    />
  )
}

export { Input }
