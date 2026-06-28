ALTER TABLE generations ADD COLUMN template_key TEXT NOT NULL DEFAULT 'soap_notes';
ALTER TABLE generations ADD COLUMN template_label TEXT NOT NULL DEFAULT 'SOAP Notes';
