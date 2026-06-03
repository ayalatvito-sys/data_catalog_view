import type { QueryKey, UseQueryOptions, UseQueryResult } from '@tanstack/react-query';
import type { CatalogStats, Dataset, DatasetList, ErrorResponse, ListDatasetsParams, LocationList } from './api.schemas';
import { customFetch } from '../custom-fetch';
import type { ErrorType } from '../custom-fetch';
type AwaitedInput<T> = PromiseLike<T> | T;
type Awaited<O> = O extends AwaitedInput<infer T> ? T : never;
type SecondParameter<T extends (...args: never) => unknown> = Parameters<T>[1];
export declare const getListDatasetsUrl: (params?: ListDatasetsParams) => string;
/**
 * Returns all datasets from the configured GCP project with Hebrew descriptions
 * @summary List all BigQuery datasets
 */
export declare const listDatasets: (params?: ListDatasetsParams, options?: RequestInit) => Promise<DatasetList>;
export declare const getListDatasetsQueryKey: (params?: ListDatasetsParams) => readonly ["/api/datasets", ...ListDatasetsParams[]];
export declare const getListDatasetsQueryOptions: <TData = Awaited<ReturnType<typeof listDatasets>>, TError = ErrorType<ErrorResponse>>(params?: ListDatasetsParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listDatasets>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof listDatasets>>, TError, TData> & {
    queryKey: QueryKey;
};
export type ListDatasetsQueryResult = NonNullable<Awaited<ReturnType<typeof listDatasets>>>;
export type ListDatasetsQueryError = ErrorType<ErrorResponse>;
/**
 * @summary List all BigQuery datasets
 */
export declare function useListDatasets<TData = Awaited<ReturnType<typeof listDatasets>>, TError = ErrorType<ErrorResponse>>(params?: ListDatasetsParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listDatasets>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getGetDatasetUrl: (datasetId: string) => string;
/**
 * @summary Get a specific dataset
 */
export declare const getDataset: (datasetId: string, options?: RequestInit) => Promise<Dataset>;
export declare const getGetDatasetQueryKey: (datasetId: string) => readonly [`/api/datasets/${string}`];
export declare const getGetDatasetQueryOptions: <TData = Awaited<ReturnType<typeof getDataset>>, TError = ErrorType<ErrorResponse>>(datasetId: string, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getDataset>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getDataset>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetDatasetQueryResult = NonNullable<Awaited<ReturnType<typeof getDataset>>>;
export type GetDatasetQueryError = ErrorType<ErrorResponse>;
/**
 * @summary Get a specific dataset
 */
export declare function useGetDataset<TData = Awaited<ReturnType<typeof getDataset>>, TError = ErrorType<ErrorResponse>>(datasetId: string, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getDataset>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getGetCatalogStatsUrl: () => string;
/**
 * Returns high-level statistics about the data catalog
 * @summary Get catalog summary statistics
 */
export declare const getCatalogStats: (options?: RequestInit) => Promise<CatalogStats>;
export declare const getGetCatalogStatsQueryKey: () => readonly ["/api/catalog/stats"];
export declare const getGetCatalogStatsQueryOptions: <TData = Awaited<ReturnType<typeof getCatalogStats>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getCatalogStats>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getCatalogStats>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetCatalogStatsQueryResult = NonNullable<Awaited<ReturnType<typeof getCatalogStats>>>;
export type GetCatalogStatsQueryError = ErrorType<unknown>;
/**
 * @summary Get catalog summary statistics
 */
export declare function useGetCatalogStats<TData = Awaited<ReturnType<typeof getCatalogStats>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getCatalogStats>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getListLocationsUrl: () => string;
/**
 * @summary List unique dataset locations
 */
export declare const listLocations: (options?: RequestInit) => Promise<LocationList>;
export declare const getListLocationsQueryKey: () => readonly ["/api/catalog/locations"];
export declare const getListLocationsQueryOptions: <TData = Awaited<ReturnType<typeof listLocations>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listLocations>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof listLocations>>, TError, TData> & {
    queryKey: QueryKey;
};
export type ListLocationsQueryResult = NonNullable<Awaited<ReturnType<typeof listLocations>>>;
export type ListLocationsQueryError = ErrorType<unknown>;
/**
 * @summary List unique dataset locations
 */
export declare function useListLocations<TData = Awaited<ReturnType<typeof listLocations>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listLocations>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export {};
//# sourceMappingURL=api.d.ts.map