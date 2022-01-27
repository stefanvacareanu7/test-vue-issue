import Vue from 'vue';
import { Pageset, Pattern } from '@/types';

export default Vue.extend({

	name: 'patternutilitymixin',

	methods: {
		/**
		 * API Returns a Pattern object
		 * Application uses a Pageset type to update the pattern.
		 * This will convert the incoming template to match the application's internal state.
		 * @param pattern
		 */
		pat_convertPatternToPageset(pattern: Pattern): Pageset {

			return {
				urlCollection: pattern.urlCollection.member ? pattern.urlCollection.member : [],
				categorizedBy: pattern.categorizedBy,
				member: pattern.member
			}
		}
	}

})