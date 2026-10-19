CREATE SCHEMA "auth";
--> statement-breakpoint
CREATE SCHEMA "game";
--> statement-breakpoint
CREATE SCHEMA "profile";
--> statement-breakpoint
CREATE TABLE "game"."discard_tiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"round_id" uuid NOT NULL,
	"seat_index" integer NOT NULL,
	"tile_code" text NOT NULL,
	"sort_index" integer NOT NULL,
	CONSTRAINT "discard_tiles_round_id_sort_index_key" UNIQUE("round_id","sort_index")
);
--> statement-breakpoint
CREATE TABLE "game"."flower_tiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"round_id" uuid NOT NULL,
	"seat_index" integer NOT NULL,
	"tile_code" text NOT NULL,
	"sort_index" integer NOT NULL,
	CONSTRAINT "flower_tiles_round_id_seat_index_sort_index_key" UNIQUE("round_id","seat_index","sort_index")
);
--> statement-breakpoint
CREATE TABLE "game"."games" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reference_code" text NOT NULL,
	"status" text NOT NULL,
	"prevailing_wind" text NOT NULL,
	"ruleset" text NOT NULL,
	"starting_score" numeric DEFAULT '0' NOT NULL,
	"hand_tile_count" integer NOT NULL,
	"win_meld_count" integer NOT NULL,
	"score_unit" text NOT NULL,
	"bonus_tiles_enabled" boolean NOT NULL,
	"chow_only_from_previous" boolean NOT NULL,
	"min_score_units" numeric DEFAULT '0' NOT NULL,
	"discard_win_payer" text NOT NULL,
	"auto_draw" boolean DEFAULT true NOT NULL,
	"claim_window_ms" integer DEFAULT 5000,
	"scoring_version" text NOT NULL,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "games_reference_code_unique" UNIQUE("reference_code"),
	CONSTRAINT "games_claim_window_ms_check" CHECK ("game"."games"."claim_window_ms" IS NULL OR "game"."games"."claim_window_ms" IN (5000, 10000))
);
--> statement-breakpoint
CREATE TABLE "game"."hand_tiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"hand_id" uuid NOT NULL,
	"tile_code" text NOT NULL,
	"sort_index" integer NOT NULL,
	"is_drawn" boolean DEFAULT false NOT NULL,
	CONSTRAINT "hand_tiles_hand_id_sort_index_key" UNIQUE("hand_id","sort_index")
);
--> statement-breakpoint
CREATE TABLE "game"."hands" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"round_id" uuid NOT NULL,
	"seat_index" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "hands_round_id_seat_index_key" UNIQUE("round_id","seat_index")
);
--> statement-breakpoint
CREATE TABLE "game"."meld_tiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"meld_id" uuid NOT NULL,
	"tile_code" text NOT NULL,
	"sort_index" integer NOT NULL,
	"is_claimed" boolean DEFAULT false NOT NULL,
	CONSTRAINT "meld_tiles_meld_id_sort_index_key" UNIQUE("meld_id","sort_index")
);
--> statement-breakpoint
CREATE TABLE "game"."melds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"round_id" uuid NOT NULL,
	"seat_index" integer NOT NULL,
	"meld_type" text NOT NULL,
	"is_concealed" boolean DEFAULT false NOT NULL,
	"from_seat_index" integer,
	"sort_index" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "melds_round_id_seat_index_sort_index_key" UNIQUE("round_id","seat_index","sort_index")
);
--> statement-breakpoint
CREATE TABLE "game"."round_scores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"round_id" uuid NOT NULL,
	"seat_index" integer NOT NULL,
	"user_id" uuid NOT NULL,
	"score_delta" numeric NOT NULL,
	"score_after" numeric NOT NULL,
	"score_units" numeric,
	"is_winner" boolean DEFAULT false NOT NULL,
	CONSTRAINT "round_scores_round_id_seat_index_key" UNIQUE("round_id","seat_index")
);
--> statement-breakpoint
CREATE TABLE "game"."rounds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"game_id" uuid NOT NULL,
	"round_index" integer NOT NULL,
	"status" text NOT NULL,
	"dealer_seat_index" integer NOT NULL,
	"prevailing_wind" text NOT NULL,
	"current_seat_index" integer NOT NULL,
	"phase" text NOT NULL,
	"result_type" text,
	"win_kind" text,
	"winner_seat_index" integer,
	"discard_from_seat_index" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rounds_game_id_round_index_key" UNIQUE("game_id","round_index")
);
--> statement-breakpoint
CREATE TABLE "game"."score_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"round_id" uuid NOT NULL,
	"from_seat_index" integer NOT NULL,
	"to_seat_index" integer NOT NULL,
	"amount" numeric NOT NULL
);
--> statement-breakpoint
CREATE TABLE "game"."seats" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"game_id" uuid NOT NULL,
	"seat_index" integer NOT NULL,
	"user_id" uuid NOT NULL,
	"running_score" numeric NOT NULL,
	"next_wind_agreed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "seats_user_id_unique" UNIQUE("user_id"),
	CONSTRAINT "seats_game_id_seat_index_key" UNIQUE("game_id","seat_index")
);
--> statement-breakpoint
CREATE TABLE "auth"."sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"is_expired" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sessions_user_id_unique" UNIQUE("user_id"),
	CONSTRAINT "sessions_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "profile"."user_attributes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"value" text NOT NULL,
	CONSTRAINT "user_attributes_user_id_name_key" UNIQUE("user_id","name")
);
--> statement-breakpoint
CREATE TABLE "profile"."user_figures" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"value" numeric NOT NULL,
	CONSTRAINT "user_figures_user_id_name_key" UNIQUE("user_id","name")
);
--> statement-breakpoint
CREATE TABLE "profile"."users" (
	"uuid" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "game"."wall_tiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"round_id" uuid NOT NULL,
	"tile_code" text NOT NULL,
	"sort_index" integer NOT NULL,
	CONSTRAINT "wall_tiles_round_id_sort_index_key" UNIQUE("round_id","sort_index")
);
--> statement-breakpoint
ALTER TABLE "game"."discard_tiles" ADD CONSTRAINT "discard_tiles_round_id_rounds_id_fk" FOREIGN KEY ("round_id") REFERENCES "game"."rounds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game"."flower_tiles" ADD CONSTRAINT "flower_tiles_round_id_rounds_id_fk" FOREIGN KEY ("round_id") REFERENCES "game"."rounds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game"."hand_tiles" ADD CONSTRAINT "hand_tiles_hand_id_hands_id_fk" FOREIGN KEY ("hand_id") REFERENCES "game"."hands"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game"."hands" ADD CONSTRAINT "hands_round_id_rounds_id_fk" FOREIGN KEY ("round_id") REFERENCES "game"."rounds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game"."meld_tiles" ADD CONSTRAINT "meld_tiles_meld_id_melds_id_fk" FOREIGN KEY ("meld_id") REFERENCES "game"."melds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game"."melds" ADD CONSTRAINT "melds_round_id_rounds_id_fk" FOREIGN KEY ("round_id") REFERENCES "game"."rounds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game"."round_scores" ADD CONSTRAINT "round_scores_round_id_rounds_id_fk" FOREIGN KEY ("round_id") REFERENCES "game"."rounds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game"."round_scores" ADD CONSTRAINT "round_scores_user_id_users_uuid_fk" FOREIGN KEY ("user_id") REFERENCES "profile"."users"("uuid") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game"."rounds" ADD CONSTRAINT "rounds_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "game"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game"."score_payments" ADD CONSTRAINT "score_payments_round_id_rounds_id_fk" FOREIGN KEY ("round_id") REFERENCES "game"."rounds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game"."seats" ADD CONSTRAINT "seats_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "game"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game"."seats" ADD CONSTRAINT "seats_user_id_users_uuid_fk" FOREIGN KEY ("user_id") REFERENCES "profile"."users"("uuid") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth"."sessions" ADD CONSTRAINT "sessions_user_id_users_uuid_fk" FOREIGN KEY ("user_id") REFERENCES "profile"."users"("uuid") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile"."user_attributes" ADD CONSTRAINT "user_attributes_user_id_users_uuid_fk" FOREIGN KEY ("user_id") REFERENCES "profile"."users"("uuid") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile"."user_figures" ADD CONSTRAINT "user_figures_user_id_users_uuid_fk" FOREIGN KEY ("user_id") REFERENCES "profile"."users"("uuid") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game"."wall_tiles" ADD CONSTRAINT "wall_tiles_round_id_rounds_id_fk" FOREIGN KEY ("round_id") REFERENCES "game"."rounds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "discard_tiles_round_id_seat_index_idx" ON "game"."discard_tiles" USING btree ("round_id","seat_index");--> statement-breakpoint
CREATE INDEX "flower_tiles_round_id_seat_index_idx" ON "game"."flower_tiles" USING btree ("round_id","seat_index");--> statement-breakpoint
CREATE INDEX "games_completed_at_idx" ON "game"."games" USING btree ("completed_at");--> statement-breakpoint
CREATE INDEX "hand_tiles_hand_id_idx" ON "game"."hand_tiles" USING btree ("hand_id");--> statement-breakpoint
CREATE INDEX "meld_tiles_meld_id_idx" ON "game"."meld_tiles" USING btree ("meld_id");--> statement-breakpoint
CREATE INDEX "melds_round_id_seat_index_idx" ON "game"."melds" USING btree ("round_id","seat_index");--> statement-breakpoint
CREATE INDEX "score_payments_round_id_idx" ON "game"."score_payments" USING btree ("round_id");--> statement-breakpoint
CREATE INDEX "user_attributes_user_id_idx" ON "profile"."user_attributes" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_figures_user_id_idx" ON "profile"."user_figures" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "wall_tiles_round_id_idx" ON "game"."wall_tiles" USING btree ("round_id");