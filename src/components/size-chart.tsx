import { getSizeGuide } from "@/lib/size-guide";

/**
 * The size chart, as a disclosure rather than a modal.
 *
 * A dialog would have to trap focus, restore it on close, and handle Escape;
 * <details> gets all of that from the browser, works before hydration, and
 * keeps the measurements in the page for anyone who wants to print it.
 *
 * Renders nothing when the product's sizes have no chart — see getSizeGuide.
 */
export function SizeChart({ sizes }: { sizes: string[] }) {
  const guide = getSizeGuide(sizes);
  if (!guide) return null;

  return (
    <details className="group">
      <summary className="cursor-pointer list-none text-sm font-medium text-accent underline-offset-2 hover:underline">
        <span className="group-open:hidden">Size chart</span>
        <span className="hidden group-open:inline">Hide size chart</span>
      </summary>

      <div className="mt-3 rounded-lg border border-black/10 p-4 dark:border-white/10">
        <p className="mb-3 text-xs font-medium text-zinc-500 dark:text-zinc-400">
          {guide.title}
        </p>

        {/* Its own scroller so a four-column table on a narrow phone never
            widens the page itself. */}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[20rem] border-collapse text-sm">
            <thead>
              <tr className="border-b border-black/10 text-left dark:border-white/10">
                {guide.columns.map((column) => (
                  <th key={column} className="py-2 pr-4 font-medium">
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {guide.rows.map((row) => (
                <tr
                  key={row[0]}
                  className="border-b border-black/5 last:border-0 dark:border-white/5"
                >
                  {row.map((cell, index) => (
                    <td
                      key={guide.columns[index]}
                      className={`py-2 pr-4 ${
                        index === 0
                          ? "font-medium"
                          : "text-zinc-600 dark:text-zinc-400"
                      }`}
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
          {guide.note}
        </p>
      </div>
    </details>
  );
}
