-- Create checkings table (rascunhos/checkings salvos do gerador de PDF)
CREATE TABLE public.checkings (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    nome TEXT NOT NULL DEFAULT 'Checking sem nome',
    dados JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.checkings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public checkings access" ON public.checkings FOR ALL USING (true);

-- Storage bucket para as imagens usadas nos checkings (capa, mapas, fotos de outdoor)
INSERT INTO storage.buckets (id, name, public)
VALUES ('checking-imagens', 'checking-imagens', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public access to checking-imagens"
ON storage.objects FOR SELECT
USING (bucket_id = 'checking-imagens');

CREATE POLICY "Public upload to checking-imagens"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'checking-imagens');

CREATE POLICY "Public update to checking-imagens"
ON storage.objects FOR UPDATE
USING (bucket_id = 'checking-imagens');

CREATE POLICY "Public delete to checking-imagens"
ON storage.objects FOR DELETE
USING (bucket_id = 'checking-imagens');
