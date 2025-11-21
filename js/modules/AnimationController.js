/**
 * Controls Lottie animation playback and state
 */
export class AnimationController {
    constructor(containerId) {
        this.containerId = containerId;
        this.anim = null;
        this.playerState = {
            isPaused: true,
            currentFrame: 0.0,
        };
    }

    /**
     * Load and initialize animation
     * @param {Object} animData - Animation data to load
     * @param {Function} onDOMLoaded - Callback when DOM is loaded
     * @param {Function} onEnterFrame - Callback on each frame
     */
    loadAnimation(animData, onDOMLoaded, onEnterFrame) {
        // Destroy existing animation
        if (this.anim) {
            this.playerState.currentFrame = this.anim.currentFrame;
            this.anim.destroy();
            document.getElementById(this.containerId).innerHTML = "";
        }

        const shouldPlayAfterReload = !this.playerState.isPaused;

        this.anim = lottie.loadAnimation({
            container: document.getElementById(this.containerId),
            renderer: "svg",
            loop: true,
            autoplay: false,
            animationData: JSON.parse(JSON.stringify(animData)),
        });

        this.anim.addEventListener("DOMLoaded", () => {
            const targetFrame = this.playerState.currentFrame;

            if (shouldPlayAfterReload) {
                this.anim.goToAndPlay(targetFrame, true);
            } else {
                this.anim.goToAndStop(targetFrame, true);
            }

            if (onDOMLoaded) {
                onDOMLoaded(this.anim.totalFrames);
            }
        });

        this.anim.addEventListener("enterFrame", () => {
            if (onEnterFrame) {
                onEnterFrame(this.anim.currentFrame);
            }
        });

        return shouldPlayAfterReload;
    }

    /**
     * Toggle play/pause state
     * @returns {boolean} New paused state
     */
    togglePlay() {
        if (!this.anim) return this.playerState.isPaused;

        if (this.anim.isPaused) {
            this.anim.play();
            this.playerState.isPaused = false;
        } else {
            this.anim.pause();
            this.playerState.isPaused = true;
        }

        return this.playerState.isPaused;
    }

    /**
     * Go to specific frame
     * @param {number} frame - Frame number
     * @param {boolean} pause - Whether to pause after going to frame
     */
    goToFrame(frame, pause = false) {
        if (!this.anim) return;

        this.playerState.currentFrame = frame;

        if (pause) {
            this.anim.goToAndStop(frame, true);
            this.playerState.isPaused = true;
        } else {
            this.anim.goToAndPlay(frame, true);
            this.playerState.isPaused = false;
        }
    }

    /**
     * Pause animation
     */
    pause() {
        if (this.anim && !this.anim.isPaused) {
            this.anim.pause();
            this.playerState.isPaused = true;
        }
    }

    /**
     * Get current animation state
     * @returns {Object} Current state
     */
    getState() {
        return {
            isPaused: this.playerState.isPaused,
            currentFrame: this.playerState.currentFrame,
        };
    }

    /**
     * Get animation instance
     * @returns {Object|null} Lottie animation instance
     */
    getAnimation() {
        return this.anim;
    }
}
