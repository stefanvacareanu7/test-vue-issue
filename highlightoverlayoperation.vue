<template>
	<div class="highlightoverlayoperation" v-show="hasAllHighlightFields" ref="highlightoverlayoperationRef">
		<div class="field-name-harness" style="all: unset !important;background-color: #fff !important;border: 1px solid #c7c7c7 !important;border-radius: 4px !important;box-shadow: 0 4px 4px 0 rgba(0, 0, 0, 0.25) !important;font-family: OpenSans-Regular, Avenir, verdana, sans-serif !important;font-size: 14px !important;color: black !important;padding: 10px !important;font-weight: 900 !important;height: fit-content !important;">
			{{ highlightLabel }}
		</div>
	</div>
</template>

<!-- <script lang="ts" src="./highlightoverlayoperation.ts"></script> -->

<script lang="js">
	import * as _ from 'lodash';
	import mixinxpathgenerator from '@/components/contentscript/mixin_xpathgenerator.js'
	import Vue from 'vue'

	export default Vue.extend({
		name: 'highlightoverlayoperation',

		// components: {},

		mixins: [
			mixinxpathgenerator
		],

		props: {
			value: {
				type: Object,
				required: false,
				default: () => {}
				// default: () => {
				// 	return {
				// 		highlightLabel: '',
				// 		highlightId: '',
				// 		highlightType: ''
				// 	}	
				// }
			}
		},
		// data () { return {} },

		// Lifecycle Hooks, for guidance see:
		// https://vuejs.org/v2/guide/instance.html#Instance-Lifecycle-Hooks
		// beforeCreate: function () {},

		created: function () {
			document.addEventListener('scroll', this.onScrollEvent);
		},

		// beforeMount: function () {},

		mounted: function () {
			// this needs to be in mounted because it depends on $refs
			// which are not populated during the created call
			this.positionOverlayDiv();
		},

		// beforeUpdate: function () {},
		// updated: function () {},

		beforeDestroy: function () {
			document.removeEventListener('scroll', this.onScrollEvent);
		},

		// destroyed: function () {},

		// filters: {},

		computed: {
			highlightLabel: function() {
				return this.value ? (this.value.highlightLabel ? this.value.highlightLabel : '') : '';
			},

			highlightId: function() {
				return this.value ? (this.value.highlightId ? this.value.highlightId : '') : '';
			},

			highlightType: function() {
				return this.value ? (this.value.highlightType ? this.value.highlightType : '') : '';
			},

			hasAllHighlightFields: function() {
				return this.highlightId !== '' && this.highlightLabel !== '' && this.highlightType !== '' ? true : false;
			}
		},

		// watch: {},

		methods: {
			positionOverlayDiv: function() {
				const targetEl = this.xpg_targetTagxpathFromHighlightId(this.highlightId);

				// it's possible for this to be called while the element is scrolling
				// if that happens, the scroll event may fire against something
				// that's offscreen, (especially because I've got the scroll event
				// debounced... the event call will be delayed). In any case, it can
				// cause this block to fail, so just blackhole the error if it does
				try {
					if (targetEl != null && targetEl != undefined) {
						const targetDOMRect = targetEl.getBoundingClientRect();

						this.$refs.highlightoverlayoperationRef.style = `
							all: unset !important;
							position: fixed !important;
							height: ${targetDOMRect.height}px !important;
							width: ${targetDOMRect.width}px !important;
							left: ${targetDOMRect.left}px !important;
							top: ${targetDOMRect.top}px !important;
							background-color: rgba(252, 99, 25, 0.5) !important;
							display: flex !important;
							flex-direction: row !important;
							justify-content: center !important;
							align-items: center !important;
						`
					}
				} catch (e) {};
			},

			// debouncing this event slightly otherwise it's ridiculous on the cpu
			onScrollEvent: _.debounce(function(ev) {
				this.positionOverlayDiv();
			}, 10),
		}
	})
</script>

<!-- Script tag for external scss file -->
<!-- <style scoped lang="scss" src="./highlightoverlayoperation.scss"></style> -->
<style lang="scss" scoped>
	// @import '@/styleguide/colors.scss';
	// @import '@/styleguide/fonts.scss';
	// @import '@/styleguide/misc.scss';
	// @import '@/globals.scss';

	// .highlightoverlayoperation {
	// 	.field-name-harness {
	// 		all: unset;
	// 		background-color: #fff;
	// 		border: 1px solid #c7c7c7;
	// 		border-radius: 4px;
	// 		box-shadow: 0 4px 4px 0 rgba(0, 0, 0, 0.25);
	// 		font-family: OpenSans-Regular, Avenir, verdana, sans-serif;
	// 		font-size: 14px;
	// 		color: black;
	// 		padding: 10px;
	// 		font-weight: 900;
	// 		height: fit-content;
	// 	}
	// }
</style>
