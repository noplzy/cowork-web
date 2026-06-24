CREATE INDEX idx_buddy_disputes_admin ON public.buddy_disputes USING btree (admin_user_id, updated_at DESC) WHERE (admin_user_id IS NOT NULL);

CREATE INDEX idx_buddy_disputes_review_queue ON public.buddy_disputes USING btree (dispute_status, created_at DESC);

CREATE INDEX idx_buddy_provider_applications_review_queue ON public.buddy_provider_applications USING btree (application_status, created_at DESC);

CREATE INDEX idx_buddy_provider_applications_reviewer ON public.buddy_provider_applications USING btree (reviewer_user_id, reviewed_at DESC) WHERE (reviewer_user_id IS NOT NULL);

CREATE INDEX idx_identity_verification_requests_review_queue ON public.identity_verification_requests USING btree (review_status, created_at DESC);

CREATE INDEX idx_identity_verification_requests_reviewer ON public.identity_verification_requests USING btree (reviewer_user_id, reviewed_at DESC) WHERE (reviewer_user_id IS NOT NULL);


