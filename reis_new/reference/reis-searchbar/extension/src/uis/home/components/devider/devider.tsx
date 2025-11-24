export interface DeviderProps{
    customStyle?:string,
};
export function Divider(props:DeviderProps){
    return (
        <div className={`w-[75%] h-0.5 border-t-1 border-t-gray-300 ${props.customStyle??""}`}>

        </div>
    )
}