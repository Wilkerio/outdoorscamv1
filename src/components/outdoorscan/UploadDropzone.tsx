import { useRef, useState } from "react";
import { Upload, FileSpreadsheet } from "lucide-react";
import { parseXlsx } from "@/lib/outdoorscan/xlsx";
import { useSession } from "@/context/SessionContext";
import { toast } from "sonner";

 export function UploadDropzone() {
   const { setPoints, points, log } = useSession();
   const fileInputRef = useRef<HTMLInputElement>(null);
   const [fileName, setFileName] = useState<string | null>(null);
 
   const handleFile = async (file: File | undefined) => {
     if (!file || !file.name.endsWith(".xlsx")) return;
     
     try {
       const pts = await parseXlsx(file, log);
       setPoints(pts);
       setFileName(file.name);
       toast.success(`${pts.length} ponto(s) carregado(s)`);
     } catch (e) {
       toast.error("Falha ao ler a planilha");
       console.error(e);
     }
   };
 
   return (
     <div
       onClick={() => fileInputRef.current?.click()}
       onDragOver={(e) => e.preventDefault()}
       onDrop={(e) => {
         e.preventDefault();
         handleFile(e.dataTransfer.files[0]);
       }}
       className="relative cursor-pointer rounded-xl border-2 border-dashed border-[#444] p-10 text-center bg-card hover:bg-accent/40 transition-colors"
     >
       <div className="flex flex-col items-center gap-3 pointer-events-none">
         <div className="size-12 rounded-full bg-primary/15 text-primary flex items-center justify-center">
           {fileName ? <FileSpreadsheet className="size-6" /> : <Upload className="size-6" />}
         </div>
         <p className="font-medium">
           {fileName ? fileName : "Arraste sua planilha .xlsx aqui ou clique para selecionar"}
         </p>
         {fileName && (
           <div className="text-sm text-muted-foreground">
             {points.length} ponto(s) prontos — solte outra planilha para substituir
           </div>
         )}
         {!fileName && (
           <div className="text-xs text-muted-foreground mt-2">
             Colunas: Cod. | Endereço | Bairro | Cidade | Latitude | Longitude | Formato | Foto | Empresa
           </div>
         )}
       </div>
       <input
         ref={fileInputRef}
         type="file"
         accept=".xlsx"
         className="hidden"
         onChange={(e) => handleFile(e.target.files?.[0])}
       />
     </div>
   );
 }