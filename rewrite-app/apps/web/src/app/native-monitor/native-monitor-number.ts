/** The native monitor displays nonnegative remaining minutes as whole numbers.
 * Browser Intl keeps the same grouping and half-expand rounding as Angular's
 * number:1.0-0 formatter without loading its full locale formatter at startup. */
const formatters=new Map<string,Intl.NumberFormat>();
export function formatNativeMonitorMinutes(value:number,locale='en-US'):string{
 let formatter=formatters.get(locale);if(!formatter){formatter=new Intl.NumberFormat(locale,{minimumFractionDigits:0,maximumFractionDigits:0});formatters.set(locale,formatter);}
 return formatter.format(value);
}
