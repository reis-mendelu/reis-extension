import type { ScreenType } from "./screens/screens";

export const PRODUCTION:boolean = false;
export interface GenericProps{
    setScreen?:React.Dispatch<React.SetStateAction<ScreenType | null>>,
}