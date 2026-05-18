import {
    ActivitiesSummary,
    ActivitiesSummaryOptions,
    ActivityDetailSummary,
    ActivityDetailSummaryOptions,
    TrainingOverview,
    TrainingOverviewOptions,
    WellnessOverview,
    WellnessOverviewOptions
} from '../types';
import {
    buildActivitiesSummary,
    buildActivityDetailSummary
} from './coach/activity-summary';
import { buildTrainingOverview } from './coach/training-overview';
import { buildWellnessOverview } from './coach/wellness-overview';
import { CoachApi } from './coach/helpers';
import { ModuleConstructor } from './types';

export function applyCoachModule(Base: ModuleConstructor) {
    return class CoachModule extends Base {
        /**
         * Build the long-term training background intended for AI coach prompts
         * and future MCP responses. This method always queries running and
         * cycling sources together, validates the token before fan-out, and
         * returns a stable `training_overview_v1` shape instead of Garmin's
         * large raw payloads.
         *
         * Data included:
         * - athlete profile: age, gender, height, weight, observed sports
         * - current training state: status, load trend, acute/chronic load, ACWR
         * - load balance: low aerobic, high aerobic, anaerobic values vs targets
         * - sport summaries: run/bike volume, key form metrics, VO2, threshold,
         *   race prediction, FTP/power-to-weight, cycling ability
         * - multi-sport interpretation, training status trend, data completeness
         *   flags, and AI hint tags
         */
        async getTrainingOverview(
            options: TrainingOverviewOptions = {}
        ): Promise<TrainingOverview> {
            return buildTrainingOverview(
                this as unknown as CoachApi,
                this.client,
                options
            );
        }

        /**
         * Build the recovery-state overview intended for daily AI coach
         * readiness prompts. It normalizes Garmin HRV, sleep, body battery,
         * resting heart rate, respiration, SpO2, and skin temperature signals
         * into a stable `wellness_overview_v1` shape.
         *
         * Users often have incomplete wellness data; unavailable metrics are
         * marked as `no_data` or `partial` rather than omitted.
         */
        async getWellnessOverview(
            options: WellnessOverviewOptions = {}
        ): Promise<WellnessOverview> {
            return buildWellnessOverview(
                this as unknown as CoachApi,
                this.client,
                options
            );
        }

        /**
         * Build a low-token, high-coverage summary of what recent training
         * happened. Use this by default when an AI coach needs activity context
         * without loading single-activity details.
         *
         * The response uses `activities_summary_v1` and removes Garmin's large
         * raw list payload fields such as privacy, owner, map, media, and
         * verbose split metadata. It keeps the data useful for training advice:
         * sport counts, duration, distance, elevation, load, heart-rate zones,
         * training effect, running form, body-battery delta, and computed flags.
         */
        async getActivitiesSummary(
            options: ActivitiesSummaryOptions = {}
        ): Promise<ActivitiesSummary> {
            return buildActivitiesSummary(
                this as unknown as CoachApi,
                this.client,
                options
            );
        }

        /**
         * Build a compact single-activity detail for AI coach analysis. Load
         * this only when the AI coach needs to analyze one specific workout
         * with finer metrics.
         *
         * The response uses `activity_detail_v1` and keeps the key details for
         * deeper post-workout reasoning: summary metrics, training impact,
         * intensity, run form, stamina, subjective feedback, sensor presence,
         * split availability, and AI hint tags.
         */
        async getActivityDetailSummary(
            options: ActivityDetailSummaryOptions | number
        ): Promise<ActivityDetailSummary> {
            const normalizedOptions =
                typeof options === 'number' ? { activityId: options } : options;
            return buildActivityDetailSummary(
                this as unknown as CoachApi,
                this.client,
                normalizedOptions
            );
        }
    };
}
