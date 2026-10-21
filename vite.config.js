import { defineConfig } from 'vite';
export default defineConfig({base:'/local-yolo/',build:{target:'es2022'},worker:{format:'es'},server:{allowedHosts:['terminal.local'],host:'0.0.0.0',port:4173,strictPort:true}});
