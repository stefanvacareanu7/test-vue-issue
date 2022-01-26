<template>
	<div></div>
</template>

<script>
	import * as _ from 'lodash';
	import mixinxpathgenerator from '@/components/contentscript/mixin_xpathgenerator.js'
	import mixinglobals from '@/components/contentscript/mixin_globals.js'

	export default {
		name: 'taglistoperation',

		// components: {},

		mixins: [
			mixinxpathgenerator,
			mixinglobals
		],

		props: {
			value: {
				type: Object,
				required: true
			}
		},

		// data () { return {} },
		// Lifecycle Hooks, for guidance see:
		// https://vuejs.org/v2/guide/instance.html#Instance-Lifecycle-Hooks
		// beforeCreate: function () {},

		created: function () {
			const cappedOperationName = _.upperFirst(this.value.operation);
			const functionName = `on${cappedOperationName}Received`

			// 'create', 'delete', 'increase', 'widen', 'apply', 'halt', 'refresh', 'retarget'
			if (_.has(this, functionName)) {
				this[functionName]();
			}
		},

		// beforeMount: function () {},
		// mounted: function () {},
		// beforeUpdate: function () {},
		// updated: function () {},

		beforeDestroy: function () {
			document.body.removeEventListener('click', this.onElementClick);
			document.body.removeEventListener('mouseover', this.onMouseOver);
			document.body.removeEventListener('mouseout', this.onMouseOut);

			this.onMouseOut();
		},

		// destroyed: function () {},
		// filters: {},

		computed: {
			dataAttributeHoveredName: function() {
				return this.glo_schemaAppDataNodes.prefix + this.glo_schemaAppDataNodes.suffixes.hovered;
			},

			dataAttributeHoveredSiblingName: function() {
				return this.glo_schemaAppDataNodes.prefix + this.glo_schemaAppDataNodes.suffixes.hoveredSibling;
			},

			dataAttributeTaglistName: function() {
				return this.glo_schemaAppDataNodes.prefix + this.glo_schemaAppDataNodes.suffixes.taglist;
			},

			dataAttributeTaglistSiblingName: function() {
				return this.glo_schemaAppDataNodes.prefix + this.glo_schemaAppDataNodes.suffixes.taglistSibling;
			}
		},

		// watch: {},

		methods: {
			halt: function() {
				this.onMouseOut();
				this.$emit('input', null);
			},

			// takes an xpathresult object, gives you back the nodes in that object 
			// as an array.
			// we need to do this roundabout craziness because if we attempt to set the 
			// attribute in the while() loop, we mutate the DOM, and cause an error on
			// the next iteration. Hence we must extract all the targets into an array,
			// then modify them in the array
			xpathResultToArray: function(xpathResult) {
				const returnArr = [];

				if (xpathResult) {
					let domNode = xpathResult.iterateNext();

					while (domNode != null) {
						returnArr.push(domNode)
						domNode = xpathResult.iterateNext();
					}
				}

				return returnArr;
			},

			onMouseOver: function(ev) {
				if (ev.target.tagName.toLowerCase() != 'body' && !this.xpg_hasSchemaAppId(ev.target)) {
					// apply target to hovered element
					ev.target.setAttribute(this.dataAttributeHoveredName, '');
				
					// get all sibling targets so can  apply the hovered sibling
					// style in realtime to all siblings
					const allSiblings = this.xpg_generateSiblingTargetsFromTarget(ev.target);
					const allSiblingsArray = this.xpathResultToArray(allSiblings);

					allSiblingsArray.forEach(el => {
						el.setAttribute(this.dataAttributeHoveredSiblingName, '');
					})
				}
			},

			onMouseOut: function() {
				const hoveredElements = document.querySelectorAll(`[${this.dataAttributeHoveredName}]`);
				const hoveredSiblingElements = document.querySelectorAll(`[${this.dataAttributeHoveredSiblingName}]`)

				for (var i = 0; i < hoveredElements.length; i++) {
					hoveredElements[i].removeAttribute(this.dataAttributeHoveredName);
				}

				for (var j = 0; j < hoveredSiblingElements.length; j++) {
					hoveredSiblingElements[j].removeAttribute(this.dataAttributeHoveredSiblingName)
				}
			},

			addValueToElementAttributeArray(el, attr, val) {
				let tempArr = [];
				const elementArrayText = el.getAttribute(attr);

				if (elementArrayText) {
					tempArr = JSON.parse(elementArrayText);
				}

				tempArr.push(val);

				el.setAttribute(attr, JSON.stringify(tempArr));
			},

			removeValueFromElementAttributeArray(el, attr, val) {
				const tempArr = JSON.parse(el.getAttribute(attr));

				tempArr.splice(tempArr.indexOf(val), 1);

				if (tempArr.length > 0) {
					el.setAttribute(attr, JSON.stringify(tempArr));
				} else {
					el.removeAttribute(attr);
				}
			},

			applyTaglistSiblingAttribute: function(targetEl, highlightId = this.value.highlightId) {
				const allSiblings = this.xpg_generateSiblingTargetsFromTarget(targetEl);
				const siblingArray = this.xpathResultToArray(allSiblings);

				// add the sibling style to all siblings
				siblingArray.forEach(el => {
					// don't mark an element as a sibling of itself
					if (el !== targetEl) {
						this.addValueToElementAttributeArray(
							el,
							this.dataAttributeTaglistSiblingName,
							highlightId
						)
					}
				})
			},

			// applies the highlightId to an element target, or appends it
			// to the array if the attribute already present
			applyTaglistAttribute: function(targetEl, highlightId = this.value.highlightId) {

				this.addValueToElementAttributeArray(
					targetEl,
					this.dataAttributeTaglistName,
					highlightId
				)
			},

			generateAndsendTaglistXpaths: function(targetEl) {
				// get all possible xpaths for a targeted element
				const allXpaths = this.getAllXpaths(targetEl);

				const msg = {
					type: 'addTaglist',
					xpaths: allXpaths,
					highlightId: this.value.highlightId,
					innerHTML: targetEl.innerHTML,
					innerText: targetEl.innerText,
					currentSrc: targetEl.currentSrc,
					outerHTML: targetEl.outerHTML,
				}

				// send the highlight data back to the pagescript
				this.glo_messagetoPagescript(msg);
			},

			onElementClick: function(ev) {
				// stop highlight click from flowing through to page
				ev.stopImmediatePropagation();
				ev.stopPropagation();
				ev.preventDefault();

				// if it's not a click on the body element or highlighter, select it
				if (ev.target.tagName.toLowerCase() != 'body' && !this.xpg_hasSchemaAppId(ev.target)) {
					// apply the xpath attribute
					this.applyTaglistAttribute(ev.target);

					// apply sibling attribute to siblings of target
					this.applyTaglistSiblingAttribute(ev.target);

					// make the xpaths and whatnot & send it
					this.generateAndsendTaglistXpaths(ev.target);

					// kill this component
					this.halt();
				}
			},

			onCreateReceived: function() {
				document.body.addEventListener('click', this.onElementClick);
				document.body.addEventListener('mouseover', this.onMouseOver);
				document.body.addEventListener('mouseout', this.onMouseOut);
			},

			// removes sibling highlights
			// requires highlight id, not target element
			removeSiblingAttributeData: function(highlightId) {
				// get all taglist sibling targets
				const allSiblings = this.xpg_allTargetsFromAttributeValue(highlightId, this.dataAttributeTaglistSiblingName)

				if (allSiblings) {
					allSiblings.forEach(el => {
						this.removeValueFromElementAttributeArray(
							el,
							this.dataAttributeTaglistSiblingName,
							highlightId
						)
					})
				}
			},

			removeTaglistAttributeData: function(taglistTargetEl) {
				if (taglistTargetEl) {
					this.removeValueFromElementAttributeArray(
						taglistTargetEl,
						this.dataAttributeTaglistName,
						this.value.highlightId
					)
				}
			},

			onDeleteReceived: function() {
				// get taglist target element
				const taglistTargetEl = this.xpg_targetTaglistFromHighlightId(this.value.highlightId);

				this.removeTaglistAttributeData(taglistTargetEl);

				this.removeSiblingAttributeData(this.value.highlightId);

				// done, shut down
				this.halt();
			},

			retargetIncreaseWiden: function(xpathArray, messageType = 'increaseWidenHasRetargeted') {
				if (xpathArray.length > 0 && xpathArray.indexOf('//body') == -1) {
					// get original and retargeted elements
					const originalEl = this.xpg_targetTaglistFromHighlightId(this.value.highlightId);
					const retargetedEl = this.xpg_firstTargetFromXpath(xpathArray[0]);

					// remove & reapply the highlight attributes
					if (originalEl != undefined && originalEl != null) {
						// this.removeHighlightAttributeData(originalEl);

						// remove attribute from original
						this.removeTaglistAttributeData(originalEl);

						// remove attribute from siblings
						this.removeSiblingAttributeData(this.value.highlightId);
					}

					if (retargetedEl != undefined && retargetedEl != null) {
						// apply the xpath attribute
						this.applyTaglistAttribute(retargetedEl);

						// apply sibling attribute to siblings of target
						this.applyTaglistSiblingAttribute(retargetedEl);
					}

					// ship final result to pagescript
					this.glo_messagetoPagescript({
						type: messageType,
						xpath: xpathArray,
						highlightId: this.value.highlightId,
					});
				}
			},

			onIncreaseReceived: function() {
				// target function will return null or a target element
				const targetEl = this.xpg_targetTaglistFromHighlightId(this.value.highlightId);

				if (targetEl != null) {
					const xpath = this.xpg_getCanonicalXpath(targetEl);
					const increasedXpath = this.xpg_generateIncreasedXpath(xpath);
					const allXpathIncreasedVariations = this.xpg_allXpathsFromXpath(increasedXpath);

					this.retargetIncreaseWiden(allXpathIncreasedVariations);
				}

				// done, shut down
				this.halt();
			},

			onWidenReceived: function() {
				// target function will return null or a target element
				const targetEl = this.xpg_targetTaglistFromHighlightId(this.value.highlightId);

				if (targetEl != null) {
					const xpath = this.xpg_getCanonicalXpath(targetEl);
					const widenedXpath = this.xpg_generateWidenedXpath(xpath);
					const allXpathWidenedVariations = this.xpg_allXpathsFromXpath(widenedXpath);

					this.retargetIncreaseWiden(allXpathWidenedVariations);
				}

				// done, shut down
				this.halt();
			},

			onApplyReceived: function() {
				console.log('onApplyReceived started: TODO');

				// done, shut down
				this.halt();
			},

			applyFoundTargetCallback: function(targetedEl, id) {
				// apply the attribs
				this.applyTaglistAttribute(targetedEl, id);

				// apply the sibling attribs
				this.applyTaglistSiblingAttribute(targetedEl, id);
			},

			onApplyTaglistHighlightArrayReceived: function() {
				const highlightList = JSON.parse(this.value.meta);

				// apply and prune the array
				const returnArr = this.glo_applyAndPruneHighlightArray(
					highlightList,
					[this.glo_highlightOntologyTypes.taglist],
					this.applyFoundTargetCallback
				);

				// launch the results into orbit and let the pagescript deal with it
				this.glo_messagetoPagescript({
					type: 'applyTaglistHighlightArrayHasApplied',
					appliedHighlights: returnArr
				})

				// done, shut down
				this.halt();
			},

			// like and Apply operation, but selects by highlight id instead of xpath
			// old highlight id is expected in the meta field on the 
			// message, new is on highlight id
			onAppendReceived: function() {
				const targetEl = this.xpg_targetTaglistFromHighlightId(this.value.meta)

				if (targetEl != null) {
					// apply the taglist attribute
					this.applyTaglistAttribute(targetEl);

					// apply sibling attribute to siblings of target
					this.applyTaglistSiblingAttribute(targetEl);

					// ship final result to pagescript
					this.glo_messagetoPagescript({
						type: 'appendHasAppended',
						highlightId: this.value.highlightId,
					});
				}

				this.halt();
			},

			onHaltReceived: function() {
				// done, shut down
				this.halt();
			},

			onRefreshReceived: function() {
				const targetEl = this.xpg_targetTaglistFromHighlightId(this.value.highlightId);

				if (targetEl != null) {

					const highlightContentMessage = {
						type: 'refreshTaglist',
						highlightId: this.value.highlightId,
						innerHTML: _.trim(targetEl.innerHTML),
						innerText: _.trim(targetEl.innerText),
						currentSrc: _.trim(targetEl.currentSrc),
						outerHTML: _.trim(targetEl.outerHTML),
					}

					this.glo_messagetoPagescript(highlightContentMessage);
				}

				// done, shut down
				this.halt();
			},

			onRetargetReceived: function() {
				// just retarget to whatever array we got, no need for new generation here
				this.retargetIncreaseWiden(this.value.xpath);

				// done, shut down
				this.halt();
			},
		}
	}
</script>

<style></style>
