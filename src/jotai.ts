import { useSyncExternalStore } from "react";

interface Atom<AtomType> {
    get: () => AtomType;
    set: (newValue: AtomType) => void;
    subscribe: (callback: (newValue: AtomType) => void) => () => void;
}

type AtomGetter<AtomType> = (
    get: <Target>(a: Atom<Target>) => Target
) => AtomType;

export function atom<AtomType>(
    initialValue: AtomType | AtomGetter<AtomType>
): Atom<AtomType> {
    let value: AtomType =
        typeof initialValue === "function" ? (null as AtomType) : initialValue;

    const subscribers = new Set<(newValue: AtomType) => void>();
    const unsubscribers = new Set<() => void>();

    function isPromise<T>(value: any): value is Promise<T> {
        return value instanceof Promise;
    }

    function isFunction(value: any): boolean {
        return typeof value === 'function';
    }

    function getInitialType(): string {
        if (isPromise(initialValue) || isFunction(initialValue))
            return "promise";

        return typeof initialValue;
    }

    function get<Target>(atom: Atom<Target>) {
        let currentValue = atom.get();
        // console.log(atom._subscribers())

        const unsubscribe = atom.subscribe((newValue) => {
            if (currentValue === newValue) return;
            computeValue();
        });
        unsubscribers.add(unsubscribe);

        return currentValue;
    }

    async function computeValue() {
        unsubscribers.forEach((unsubscribe) => {
            unsubscribe();
            unsubscribers.delete(unsubscribe);
        });

        const newValue =
            typeof initialValue === "function"
                ? await (initialValue as AtomGetter<AtomType>)(get)
                : value;
        value = null as AtomType;
        value = await newValue;
        subscribers.forEach((callback) => callback(value));
    }

    computeValue();

    return {
        get: () => value,
        set: (newValue) => {
            value = newValue;
            subscribers.forEach((callback) => callback(value));
        },
        subscribe: (callback) => {
            subscribers.add(callback);
            return () => {
                subscribers.delete(callback);
            };
        },
    };
}

export function useAtom<AtomType>(atom: Atom<AtomType>): [AtomType, (newValue: AtomType) => void] {
    const value: AtomType = useSyncExternalStore(atom.subscribe, atom.get);
    return [value, atom.set];
}

export function useAtomValue<AtomType>(atom: Atom<AtomType>): AtomType {
    return useSyncExternalStore(atom.subscribe, atom.get);
}

export function useAtomSet<AtomType>(atom: Atom<AtomType>): (newValue: AtomType) => void {
    return atom.set;
}
