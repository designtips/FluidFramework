/*!
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */

import { IComponent } from "@microsoft/fluid-component-core-interfaces";
import { IComponentHTMLOptions, IComponentHTMLView, IComponentReactViewable } from "@microsoft/fluid-view-interfaces";
import * as React from "react";
import * as ReactDOM from "react-dom";

/**
 * Abstracts rendering of components via the IComponentHTMLView interface.  Supports React elements, as well as
 * components that implement IComponentReactViewable, IComponentHTMLView, or IComponentHTMLVisual.
 *
 * If the component is none of these, we render an empty <span />
 */
export class HTMLViewAdapter implements IComponentHTMLView {
    public get IComponentHTMLView() { return this; }

    public static canAdapt(component: IComponent) {
        return (
            React.isValidElement(component)
            || component.IComponentReactViewable !== undefined
            || component.IComponentHTMLView !== undefined
            || component.IComponentHTMLVisual !== undefined
        );
    }

    /**
     * A reference to the current container node for this view so we can unmount it appropriately in
     * the React cases.  This also doubles as a way for us to know if we are mounted or not.
     */
    private containerNode: HTMLElement | undefined;

    /**
     * If the component is an IComponentHTMLVisual we will create and persist one IComponentHTMLView from it, which
     * we will retain across rendering/removal.
     */
    private viewFromVisual: IComponentHTMLView | undefined;

    constructor(private readonly component: IComponent) { }

    public render(elm: HTMLElement, options?: IComponentHTMLOptions) {
        // Note that if we're already mounted, this can cause multiple rendering with possibly unintended effects.
        // Probably try to avoid doing this.
        this.containerNode = elm;

        if (React.isValidElement(this.component)) {
            ReactDOM.render(this.component, elm);
            return;
        }

        const reactViewable = this.component.IComponentReactViewable;
        if (reactViewable !== undefined) {
            ReactDOM.render(<ReactViewableEmbeddedComponent component={reactViewable} />, elm);
            return;
        }

        const htmlView = this.component.IComponentHTMLView;
        if (htmlView !== undefined) {
            htmlView.render(elm, options);
            return;
        }

        const htmlVisual = this.component.IComponentHTMLVisual;
        if (htmlVisual !== undefined) {
            if (this.viewFromVisual === undefined) {
                // This is the first time we're trying to render, so get a view.
                this.viewFromVisual = htmlVisual.addView();
            }
            this.viewFromVisual.render(elm, options);
            return;
        }

        // Either it's an unrenderable component, or using some framework we don't support.
        // In that case, we render nothing.
    }

    public remove() {
        if (this.containerNode === undefined) {
            // Then we are already unmounted.
            return;
        }

        if (React.isValidElement(this.component)) {
            // Not ideal - this will also remove the component from the DOM.  But not sure how else to enter into
            // componentWillUnmount handling which is what we really want.
            ReactDOM.unmountComponentAtNode(this.containerNode);
            this.containerNode = undefined;
            return;
        }

        const reactViewable = this.component.IComponentReactViewable;
        if (reactViewable !== undefined) {
            // Not ideal - this will also remove the component from the DOM.  But not sure how else to enter into
            // componentWillUnmount handling which is what we really want.
            ReactDOM.unmountComponentAtNode(this.containerNode);
            this.containerNode = undefined;
            return;
        }

        const htmlView = this.component.IComponentHTMLView;
        if (htmlView !== undefined && htmlView.remove !== undefined) {
            htmlView.remove();
            this.containerNode = undefined;
            return;
        }

        const htmlVisual = this.component.IComponentHTMLVisual;
        if (htmlVisual !== undefined && this.viewFromVisual !== undefined && this.viewFromVisual.remove !== undefined) {
            this.viewFromVisual.remove();
            this.containerNode = undefined;
            return;
        }
    }
}

interface IReactProps {
    component: IComponentReactViewable;
}

/**
 * Embeds a Fluid Component that supports IComponentReactViewable
 */
const ReactViewableEmbeddedComponent = (props: IReactProps) => props.component.createJSXElement();
