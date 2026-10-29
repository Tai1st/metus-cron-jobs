interface AnyObject {
    [key: string]: any;
}

interface IResponse<T> {
    statusCode: number;
    data: T;
    message: string[] | string | null;
}
