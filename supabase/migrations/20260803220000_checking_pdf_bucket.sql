-- Bucket separado para os PDFs gerados (link compartilhável)
INSERT INTO storage.buckets (id, name, public)
VALUES ('checking-pdfs', 'checking-pdfs', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public access to checking-pdfs"
ON storage.objects FOR SELECT
USING (bucket_id = 'checking-pdfs');

CREATE POLICY "Public upload to checking-pdfs"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'checking-pdfs');

CREATE POLICY "Public update to checking-pdfs"
ON storage.objects FOR UPDATE
USING (bucket_id = 'checking-pdfs');

CREATE POLICY "Public delete to checking-pdfs"
ON storage.objects FOR DELETE
USING (bucket_id = 'checking-pdfs');

-- Guarda o ultimo link de PDF gerado junto com o checking salvo
ALTER TABLE public.checkings ADD COLUMN IF NOT EXISTS pdf_url TEXT;
