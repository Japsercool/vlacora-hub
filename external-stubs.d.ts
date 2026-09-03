declare var process: {env:Record<string,string|undefined>};

declare namespace React {
  type ReactNode = any;
  type SetStateAction<S> = S | ((prevState:S)=>S);
  type Dispatch<A> = (value:A)=>void;
  type FormEvent<T = Element> = {preventDefault():void;currentTarget:T;target:T};
  interface Context<T>{__value?:T}
}
declare module "react" {
  export type ReactNode = any;
  export type FormEvent<T = Element> = React.FormEvent<T>;
  export type Context<T> = React.Context<T>;
  export function useState<S>(initialState:S|(()=>S)): [S, React.Dispatch<React.SetStateAction<S>>];
  export function useEffect(effect:()=>void|(()=>void), deps?:readonly any[]): void;
  export function useMemo<T>(factory:()=>T, deps:readonly any[]):T;
  export function useCallback<T extends (...args:any[])=>any>(callback:T,deps:readonly any[]):T;
  export function useRef<T>(initialValue:T):{current:T};
  export function createContext<T>(defaultValue:T):React.Context<T>;
  export function useContext<T>(context:React.Context<T>):T;
}

type JSXEvent={target:any;currentTarget:any;preventDefault():void;stopPropagation():void;dataTransfer:any};
type JSXProps={children?:any;key?:any;className?:string;style?:any;onClick?:(e:JSXEvent)=>any;onChange?:(e:JSXEvent)=>any;onSubmit?:(e:JSXEvent)=>any;onInput?:(e:JSXEvent)=>any;onKeyDown?:(e:JSXEvent)=>any;onKeyUp?:(e:JSXEvent)=>any;onDragStart?:(e:JSXEvent)=>any;onDragOver?:(e:JSXEvent)=>any;onDrop?:(e:JSXEvent)=>any;onMouseDown?:(e:JSXEvent)=>any;onMouseUp?:(e:JSXEvent)=>any;onBlur?:(e:JSXEvent)=>any;onFocus?:(e:JSXEvent)=>any;[key:string]:any};
declare namespace JSX { interface IntrinsicElements {[elemName:string]: JSXProps} interface IntrinsicAttributes {key?:any} interface ElementChildrenAttribute {children:{}} type Element = any; }

declare module "next" { export type Metadata = any; }
declare module "next/link" { const Link:(props:any)=>any; export default Link; }
declare module "next/navigation" {
  export function useRouter():{push:(x:string)=>void;replace:(x:string)=>void;refresh:()=>void;back:()=>void};
  export function useSearchParams():{get:(x:string)=>string|null};
  export function redirect(x:string):never;
}
declare module "next/headers" { export function cookies(): any; }
declare module "next/server" {
  export class NextRequest { url:string; nextUrl:any; headers:any; cookies:any; }
  export class NextResponse { static next(x?:any):any; static json(x?:any,y?:any):any; static redirect(x:any,y?:any):any; cookies:any; headers:any; }
}
type CookieSetter={name:string;value:string;options?:any};
declare module "@supabase/ssr" {
  export function createServerClient(url:string,key:string,options:{cookies:{getAll:()=>any;setAll:(cookiesToSet:CookieSetter[])=>void}}):any;
  export function createBrowserClient(...args:any[]):any;
}
declare module "@supabase/supabase-js" { export function createClient(...args:any[]):any; }
declare module "jspdf" { class jsPDF { constructor(...args:any[]); [key:string]:any } export default jsPDF; }
declare module "xlsx" { const x:any; export = x; export default x; }
