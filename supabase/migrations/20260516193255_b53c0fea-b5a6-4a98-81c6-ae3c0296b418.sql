-- Create sessoes table
CREATE TABLE public.sessoes (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    nome_arquivo TEXT NOT NULL,
    total_pontos INTEGER NOT NULL DEFAULT 0,
    processados INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'idle'
);

-- Create pontos table
CREATE TABLE public.pontos (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    sessao_id UUID REFERENCES public.sessoes(id) ON DELETE CASCADE,
    cod TEXT,
    endereco TEXT,
    bairro TEXT,
    cidade TEXT,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    formato TEXT,
    empresa TEXT,
    status TEXT NOT NULL DEFAULT 'aguardando',
    foto_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.sessoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pontos ENABLE ROW LEVEL SECURITY;

-- Policies (Public for now)
CREATE POLICY "Public sessoes access" ON public.sessoes FOR ALL USING (true);
CREATE POLICY "Public pontos access" ON public.pontos FOR ALL USING (true);

-- Storage bucket
INSERT INTO storage.buckets (id, name, public) 
VALUES ('imagens-outdoors', 'imagens-outdoors', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Public access to imagens-outdoors"
ON storage.objects FOR SELECT
USING (bucket_id = 'imagens-outdoors');

CREATE POLICY "Public upload to imagens-outdoors"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'imagens-outdoors');

CREATE POLICY "Public update to imagens-outdoors"
ON storage.objects FOR UPDATE
USING (bucket_id = 'imagens-outdoors');

CREATE POLICY "Public delete to imagens-outdoors"
ON storage.objects FOR DELETE
USING (bucket_id = 'imagens-outdoors');
