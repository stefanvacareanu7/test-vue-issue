import { AnalyticsManager, EventType } from "@app/utils/manager/AnalyticsManager";
import { SubscriptionError, SubscriptionUtils } from "@app/utils/SubscriptionUtils";
import { UserOperatorEditorStore } from "@app/view/components/user-operator-editor/UserOperatorEditorStore";
import { Intent } from "@blueprintjs/core";
import Keycloak from "keycloak-js";
import { action, computed, flow, makeObservable, observable, reaction, runInAction } from "mobx";
import { getSnapshot, SnapshotIn, SnapshotOut } from "mobx-state-tree";
import {
    CsvFile,
    CsvUploadUtil,
    Dashboard,
    DataConnector,
    DataSpaceSetting,
    DataSpaceType,
    DevSpace,
    getContext,
    GoogleSheet,
    IAnyDataset,
    IAppContext,
    ICompositeTransform,
    IComputation,
    ICsvFile,
    ICsvFormatType,
    IDashboard,
    IDataConnector,
    IDataset,
    IDataSpace,
    IDataSpaceSetting,
    IDevSpace,
    IGoogleSheet,
    IHeartbeat,
    InkMode,
    IOperatorElement,
    IParquetFile,
    IRefreshSchedule,
    IRoot,
    IS3File,
    ISqlDataset,
    ITransformParametersModel,
    IUserOperator,
    IUserOperatorSynchronization,
    IWorkflowDescription,
    IWorkspace,
    LiveState,
    MainMenuItemType,
    OnboardingFlows,
    OperatorUtil,
    PatchType,
    ProgressToast,
    Root,
    S3File,
    SqlDataset,
    TextToast,
    Utils,
    ValueFormatter,
    ViewMode,
    Workspace
} from "montana-api";
import { main } from "..";
import { Call } from "../io/call/Call";
import { MontanaGateway } from "../io/MontanaGateway";
import { MontanaSocketGateway } from "../io/MontanaSocketGateway";
import { LaaxAppContext } from "../LaaxAppContext";
import { Settings } from "../Settings";
import { ErrorLogger } from "../utils/ErrorLogger";
import { MainMenuEditingCategory } from "../viewstate/MainMenuEditingCategory";
import { CallToActionState } from "./CallToActionState";
import { ContentDialogState } from "./ContentDialogState";
import { ContextMenuState } from "./ContextMenuState";
import { DashboardGridStore } from "./DashboardGridStore";
import { DataSpaceMenuState } from "./DataSpaceMenuState";
import {
    CsvDatasetDetailsDialogState,
    DatasetPreviewDialogState,
    GSheetDatasetDetailsDialogState,
    RefreshScheduleDialogState,
    S3DatasetDetailsDialogState,
    SqlDatasetDetailsDialogState
} from "./mainmenudialog/MainMenuItemDialogStates";
import { MainMenuState } from "./MainMenuState";
import { MainStateRouter } from "./MainStateRouter";
import { OnboardingState } from "./onboarding/OnboardingState";
import { FileUploadingViewState, PreviewViewState } from "./onboarding/OnboardingViewStates";
import { OwnableSharingViewState } from "./OwnableSharingViewState";
import { SyncedUserOperatorSharingViewState } from "./SyncedUserOperatorSharingViewState";
import { ToastState } from "./ToastState";
import { WorkflowState } from "./WorkflowState";
import { OperatorSelectionDialogState } from "./workspacemenu/OperatorSelectionDialogState";
import { WorkspaceMenuState } from "./workspacemenu/WorkspaceMenuState";
import { WorkspaceState } from "./WorkspaceState";

export class MainState {
    private _context: IAppContext;

    @observable
    private RootModel: IRoot = null;

    public InkOnStylus: boolean = true;

    public Router: MainStateRouter;

    @observable
    public IsFullScreen: boolean;

    @observable
    public IsDroppingFile: boolean;

    @observable
    public InkMode: InkMode = InkMode.Disabled;

    @observable
    public MainMenu: MainMenuState;

    @observable
    public Workspace: WorkspaceState;

    @observable
    public SharingViewState: OwnableSharingViewState;

    @observable
    public SyncedUserOperatorSharingViewState: SyncedUserOperatorSharingViewState;

    @observable
    public WorkspaceMenu: WorkspaceMenuState;

    @observable
    public OperatorSelectionDialog: OperatorSelectionDialogState;

    @observable
    public DataSpaceMenu: DataSpaceMenuState;

    @observable
    public DashboardGridStore: DashboardGridStore;

    @observable
    public ContentDialogState: ContentDialogState;

    @observable
    public OnboardingState: OnboardingState;

    @observable
    public CallToActionState: CallToActionState;

    @observable
    public WorkflowState: WorkflowState;

    @observable
    public ToastState: ToastState;

    @observable
    public IsTouchMode: boolean = false;

    @observable
    public IsAuthenticated: boolean = undefined;

    @observable
    public DataSpaceNotFound: boolean = false;

    @observable
    public ActiveHelpLink: string = null;

    @observable
    public ViewMode: ViewMode = ViewMode.LoadingLight;

    @observable
    public MobileWarningIgnored: boolean = false;

    @observable
    public BrowserScaleWarningIgnored: boolean = false;

    @observable
    public SendPatches: Map<PatchType, boolean> = new Map();

    @observable
    public ContextMenuState: ContextMenuState = new ContextMenuState();

    @observable
    public UploadProgress: number = 0;

    private _disposables: (() => void)[] = [];

    private _runtimePingInterval = null;

    public Keycloak: Keycloak.KeycloakInstance = window["keycloak"];

    @observable
    public Call: Call;

    @observable
    public IsAudioMuted: boolean = false;

    @observable
    public IsVideoMuted: boolean = false;

    @observable
    public SelectedAudioInputDevice: MediaDeviceInfo;

    @observable
    public SelectedAudioOutputDevice: MediaDeviceInfo;

    @observable
    public SelectedVideoInputDevice: MediaDeviceInfo;

    @observable
    public RequestsInProgress: { progressId: string; request: XMLHttpRequest }[] = [];

    @observable
    public UserOperatorEditorStore: UserOperatorEditorStore;

    @observable
    public UserGuideShown: boolean = false;

    @computed
    public get IsInLoadingViewMode(): boolean {
        return this.ViewMode === ViewMode.LoadingDark || this.ViewMode === ViewMode.LoadingLight;
    }

    @computed
    public get IsAppOpen(): boolean {
        return this.IsAuthenticated && !this.IsInLoadingViewMode;
    }

    @computed
    public get IsOnboardingShown(): boolean {
        if (!main.Context.GetRoot()?.Realm?.IsSaaS) {
            return false;
        }
        if (this.OnboardingState.UserRequestedOnboarding) {
            return true;
        }

        return this.IsAppOpen && !!this.RootModel?.User?.OnboardingFlowsToShow?.get(OnboardingFlows.FIRST_LAUNCH);
    }

    @computed
    public get IsHelpShown(): boolean {
        return this.IsAppOpen && !!this.RootModel?.User?.ShowHelp;
    }

    constructor() {
        makeObservable(this);
    }

    private PostAddDataset(dataset: IDataset): IDataset {
        main.Context.GetRoot().UpdateEntity(MainMenuItemType.DATASET, new Map([[dataset._id, dataset]]), true);
        const currentWorkspace = main.Context.GetRoot().ActiveDataSpace?.DataSpace as IWorkspace;
        if (currentWorkspace) {
            currentWorkspace.AddDatasetId(dataset._id);
            MontanaGateway.Instance.UpdateDatasetIds(currentWorkspace).then(async () => {
                await main.UpdateDatasetsInDataSpace(currentWorkspace);
            });
        }
        return main.Context.GetRoot().Datasets.get(dataset._id);
    }

    public Init(): void {
        MontanaSocketGateway.Instance.Connect();
        if (window) {
            this.Router = new MainStateRouter();
        }

        this.DataSpaceMenu = new DataSpaceMenuState();
        this._context = new LaaxAppContext();
        this.RootModel = Root.create({}, this._context);
        this._context.SetRoot(this.RootModel);
        this.MainMenu = new MainMenuState(this._context);
        this.SharingViewState = new OwnableSharingViewState(this._context);
        this.SyncedUserOperatorSharingViewState = new SyncedUserOperatorSharingViewState(this._context);
        this.WorkspaceMenu = new WorkspaceMenuState(this._context);
        this.OperatorSelectionDialog = new OperatorSelectionDialogState(this._context);
        this.DashboardGridStore = new DashboardGridStore();
        this.ContentDialogState = new ContentDialogState();
        this.OnboardingState = new OnboardingState();
        this.CallToActionState = new CallToActionState();
        this.WorkflowState = new WorkflowState();
        this.ToastState = new ToastState();
        this.UserOperatorEditorStore = new UserOperatorEditorStore();

        window["root"] = () => getSnapshot(this.RootModel);
        window["dataSpace"] = () => getSnapshot(this.RootModel.ActiveDataSpace?.DataSpace);

        // eslint-disable-next-line
        console.log({ realm: Settings.Instance.AuthRealm, authUrl: MontanaGateway.AuthUrl });

        for (const type in PatchType) {
            this.SendPatches.set(PatchType[type], true);
        }

        this._disposables.push(
            reaction(
                () => this.IsAudioMuted,
                (muted) => {
                    this.Call?.CallObject?.setLocalAudio(!muted);
                }
            )
        );

        this._disposables.push(
            reaction(
                () => this.IsVideoMuted,
                (muted) => {
                    this.Call?.CallObject?.setLocalVideo(!muted);
                }
            )
        );

        let prevViewMode = this.ViewMode;
        this._disposables.push(
            reaction(
                () => this.ViewMode,
                () => {
                    if (prevViewMode === ViewMode.Workspace && this.ViewMode === ViewMode.MainMenu) {
                        this._context.GetRoot().ActiveDataSpace?.DataSpace?.UpdateScreenshotTimestamp();
                    }
                    prevViewMode = this.ViewMode;

                    // set help link to the right value whren viewMode changes
                    switch (this.ViewMode) {
                        case ViewMode.Dashboard:
                            this.SetActiveHelpLink("https://einblick.ai/learn/docs/functionality/organization-and-sharing/dashboards");
                            break;
                        case ViewMode.Workspace:
                            this.SetActiveHelpLink("https://einblick.ai/learn/docs/introduction/fundamentals/canvases");
                            break;
                        case ViewMode.MainMenu:
                            this.SetActiveHelpLink("https://einblick.ai/learn/docs/introduction/fundamentals/main-menu");
                            break;
                        case ViewMode.UserOperator:
                            this.SetActiveHelpLink("https://einblick.ai/learn/docs/operators/user-defined-operators/introduction");
                            break;
                    }
                }
            )
        );

        this._disposables.push(
            reaction(
                () => [
                    !!this.RootModel?.ActiveDataSpace?.DataSpace?.IsActive &&
                        MontanaSocketGateway.Instance.IsConnectedToCubeAndControlPlane,
                    this.RootModel?.ActiveDataSpace?.DataSpace?.Runtime?.HaveKernelResponse
                ],
                ([isMontanaResponsive, isKernelResponsive]) => {
                    const runtime = this.RootModel?.ActiveDataSpace?.DataSpace?.Runtime;
                    if (!runtime) {
                        return;
                    }

                    // 2 things may have changed if this reaction triggers:
                    //   1. connectivity to Montana
                    //   2. connectivity to kernel

                    // In either case, regardless of either connectivity going online or offline, we want to stop any previous ping interval.
                    clearInterval(this._runtimePingInterval);

                    // If not connected to Montana, there is nothing left to do.
                    if (!isMontanaResponsive) {
                        return;
                    }

                    // If not connected to kernel, ping every 5 seconds.
                    if (!isKernelResponsive) {
                        this._runtimePingInterval = setInterval(() => {
                            this.RootModel?.ActiveDataSpace?.DataSpace?.Runtime.Ping();
                        }, 5000);
                    }

                    // If we haven't once connected to the kernel, fire an initial ping after 1 second (to give subscription time to initialize).
                    if (!runtime.WasKernelReached) {
                        setTimeout(() => this.RootModel?.ActiveDataSpace?.DataSpace?.Runtime.Ping(), 1000);
                    }
                },
                { fireImmediately: true }
            ),
            () => clearInterval(this._runtimePingInterval)
        );
    }

    public UserHasRole(role: string): boolean {
        return this.Keycloak.realmAccess.roles.includes(role);
    }

    public UserHasRealmManagementRoles(role: string): boolean {
        return this.Keycloak.resourceAccess?.["realm-management"]?.roles.includes(role);
    }

    public LoadAndOpenDataSpace = flow(function* (
        dataSpaceId: string,
        dataSpaceType: DataSpaceType,
        elementId?: string,
        transform?: SnapshotOut<ITransformParametersModel>,
        dashboardMetadataId?: string,
        bookmarkId?: string
    ) {
        let patchType = PatchType.Unknown;
        if (dataSpaceType === DataSpaceType.DevSpace) {
            patchType = PatchType.DevSpace;
        } else if (dataSpaceType === DataSpaceType.Dashboard) {
            patchType = PatchType.Dashboard;
        } else if (dataSpaceType === DataSpaceType.Workspace) {
            patchType = PatchType.Workspace;
        }

        const switchingBetweenWorkspaceAndDashboardDraft =
            this.RootModel.ActiveDataSpace?.DataSpace._id === dataSpaceId && (dashboardMetadataId || main.ViewMode === ViewMode.Dashboard);
        let workspace: IWorkspace = this.RootModel.ActiveDataSpace?.DataSpace;
        if (!switchingBetweenWorkspaceAndDashboardDraft) {
            this.CloseActiveDataSpace();
            MontanaSocketGateway.Instance.SubscribeToChanges(dataSpaceId, patchType, false);
        }
        let viewMode: ViewMode = ViewMode.Workspace;
        try {
            if (dataSpaceType === DataSpaceType.Workspace) {
                // only load resources if we're switching data space, i.e. not when swichting between workspaces and dashboard draft
                if (!switchingBetweenWorkspaceAndDashboardDraft) {
                    const result: [SnapshotOut<IWorkspace>, SnapshotOut<IDataSpaceSetting>] = yield MontanaGateway.Instance.LoadWorkspace(
                        dataSpaceId
                    );

                    if (!result || !result[0]) {
                        this.DataSpaceNotFound = true;
                        this.ViewMode = viewMode;
                        return;
                    }
                    yield this.loadUserOperatorsForDataspace(result[0], DataSpaceType.Workspace);

                    workspace = Workspace.create(result[0], this._context);
                    const dataSpaceSetting: IDataSpaceSetting = DataSpaceSetting.create(result[1], this._context);
                    dataSpaceSetting.CompositeTransform.SetClientSize(window.innerWidth, window.innerHeight);
                    this.RootModel.SetActiveDataSpace(workspace, true, DataSpaceType.Workspace, dataSpaceSetting);

                    yield main.loadRefreshSchedulesForDataspace();

                    this.WorkspaceMenu.Dispose();
                    this.WorkspaceMenu = new WorkspaceMenuState(this._context);
                    this.OperatorSelectionDialog.Dispose();
                    this.OperatorSelectionDialog = new OperatorSelectionDialogState(this._context);
                    const dashboards = yield MontanaGateway.Instance.LoadDashboardsForWorkspace(workspace);

                    const dashboardsMap = new Map<string, IDashboard>(dashboards.map((s) => [s._id, s]));
                    this._context.GetRoot().UpdateEntity(MainMenuItemType.DASHBOARD, dashboardsMap, true);

                    if (this.RootModel.ActiveDataSpace?.DataSpace?.IsEditable) {
                        MontanaSocketGateway.Instance.DavosSubscribe(dataSpaceId, dataSpaceType);
                    }

                    if (this._context.GetRoot().User) {
                        yield this.UpdateDatasetsInDataSpace(workspace);
                    }

                    const compositeTransform = this._context.GetRoot().ActiveDataSpace.Settings.CompositeTransform as ICompositeTransform;
                    compositeTransform.SetClientSize(window.innerWidth, window.innerHeight);

                    if (transform) {
                        compositeTransform.CenterOn(transform.CenterX, transform.CenterY, transform.Zoom, true);
                    }

                    if (elementId) {
                        const element = workspace.Elements.get(elementId) as IOperatorElement;
                        if (element) {
                            compositeTransform.CenterOn(element.Center.X, element.Center.Y, 0.8, true);
                        }
                    }

                    if (bookmarkId) {
                        const bookmark = workspace.Bookmarks.get(bookmarkId);
                        if (bookmark) {
                            const compositeTransform = this._context.GetRoot().ActiveDataSpace.Settings.CompositeTransform;
                            compositeTransform.SetParameters(getSnapshot(bookmark.TransformParameters));
                        }
                    }

                    if (dashboardMetadataId) {
                        workspace.SetActiveDashboardId(dashboardMetadataId);
                        viewMode = ViewMode.Dashboard;
                    } else {
                        workspace.SetActiveDashboardId(null);
                        viewMode = ViewMode.Workspace;
                    }

                    workspace.SetIsActive();
                    this.Workspace?.Dispose();
                    this.Workspace = new WorkspaceState(workspace);
                    setTimeout(() => {
                        const docSize = JSON.stringify(result[0]).length;
                        this.Workspace.ShowExceededCanvasSizeWarning = docSize > 14000000;
                    }, 2000);

                    if (workspace.IsTutorial) {
                        getContext(workspace).GetRoot().User.SetShowHelp(true);
                    }
                } else {
                    if (dashboardMetadataId) {
                        workspace.SetActiveDashboardId(dashboardMetadataId);
                        viewMode = ViewMode.Dashboard;
                    } else {
                        workspace.SetActiveDashboardId(null);
                        viewMode = ViewMode.Workspace;
                    }
                }
            } else if (dataSpaceType === DataSpaceType.DevSpace) {
                viewMode = ViewMode.UserOperator;
                const result = yield MontanaGateway.Instance.LoadDevSpace(dataSpaceId);
                const devSpace = DevSpace.create(result[0], this._context);
                const dataSpaceSetting: IDataSpaceSetting = DataSpaceSetting.create(result[1], this._context);
                this.RootModel.SetActiveDataSpace(devSpace, true, DataSpaceType.DevSpace, dataSpaceSetting);
                if (this.RootModel.ActiveDataSpace?.DataSpace?.IsEditable) {
                    MontanaSocketGateway.Instance.DavosSubscribe(dataSpaceId, dataSpaceType);
                }

                yield this.UpdateDatasetsInDataSpace(devSpace);
                devSpace.SetIsActive();
                if (!devSpace.TestOperator) {
                    devSpace.Fill(this._context.GetRoot().UserOperators.get(this.UserOperatorEditorStore.ActiveUserOperatorId));
                }
                this._context.GetRoot().UpdateDevSpace(devSpace);
            } else if (dataSpaceType === DataSpaceType.Dashboard) {
                viewMode = ViewMode.Dashboard;
                const dashboardLoadResult = yield MontanaGateway.Instance.LoadDashboardSnapshot(dataSpaceId);
                const dashboardSnapshot = dashboardLoadResult[0] as SnapshotIn<IDashboard>;
                const dataSpaceSetting: IDataSpaceSetting = DataSpaceSetting.create(dashboardLoadResult[1], this._context);

                let hasParentWorkspace = false;
                try {
                    const workspaceLoadResult = yield MontanaGateway.Instance.LoadWorkspace(
                        dashboardSnapshot.DashboardMetadata.ParentWorkspaceId
                    );
                    hasParentWorkspace = !!workspaceLoadResult[0];
                } catch (e) {}

                yield this.loadUserOperatorsForDataspace(dashboardLoadResult[0], DataSpaceType.Dashboard);

                const dashboard = Dashboard.create(dashboardSnapshot);
                dashboard.SetHasParentWorkspace(hasParentWorkspace);
                this.RootModel.SetActiveDataSpace(dashboard, true, DataSpaceType.Dashboard, dataSpaceSetting);

                yield main.loadRefreshSchedulesForDataspace();

                MontanaSocketGateway.Instance.DavosSubscribe(dataSpaceId, dataSpaceType);

                if (this._context.GetRoot().User) {
                    yield this.UpdateDatasetsInDataSpace(dashboard);
                }

                dashboard.SetIsActive();

                // auto-update dashboard if it contains any stale root dataframe
                const staleRootComputations = dashboard.RootComputationsWithStaleLinks;
                staleRootComputations.forEach((rootCompId) => {
                    const computation = dashboard.Computations.get(rootCompId);
                    dashboard.UpdateStaleRootComputation(computation as IComputation);
                });
            } else {
                return;
            }

            if (this.RootModel.ActiveDataSpace?.DataSpace) {
                AnalyticsManager.Instance.Track(EventType.DATASPACE_OPENED, {
                    dataSpaceId: dataSpaceId,
                    dataSpaceType: dataSpaceType,
                    dataSpaceName: this.RootModel.ActiveDataSpace?.DataSpace?.Name,
                    isOwner: this.RootModel.ActiveDataSpace?.DataSpace.OwnerUserId === this.RootModel.User?._id
                });
            }
        } catch (e) {
            this.DataSpaceNotFound = true;
            ErrorLogger.Log(e);
        }
        this.ViewMode = viewMode;
    });

    public OpenUserOperator = flow(function* (userOperatorId: string) {
        const devSpaceId = yield MontanaGateway.Instance.GetDevSpaceId(userOperatorId);
        if (devSpaceId) {
            main.UserOperatorEditorStore.SetActiveUserOperatorId(userOperatorId);
            main.RootModel.User.SetRecentlyViewedItem(userOperatorId, MainMenuItemType.USER_OPERATOR);
            main.LoadAndOpenDataSpace(devSpaceId, DataSpaceType.DevSpace);
        } else {
            main._context.ShowToastMessage(new TextToast({ message: "Cannot access user operator" }));
        }
    });

    private async loadUserOperatorsForDataspace(result: SnapshotOut<IDataSpace>, dataSpaceType: DataSpaceType): Promise<void> {
        const [dataSpaceUserOperators, globalUserOperators] = await Promise.all([
            MontanaGateway.Instance.LoadUserOperatorsForDataSpace(result._id, dataSpaceType).catch((e) => []),
            MontanaGateway.Instance.LoadGlobalUserOperators().catch((e) => []),
            MontanaGateway.Instance.LoadEntities(MainMenuItemType.USER_OPERATOR, 1000, true).catch((e) => [])
        ]);

        this._context.GetRoot().UpdateUserOperatorsArray(dataSpaceUserOperators, false);
        this._context.GetRoot().UpdateUserOperatorsArray(globalUserOperators, false);
    }

    private async loadRefreshSchedulesForDataspace(): Promise<void> {
        // only load refresh schedules if it looks like they haven't been loaded yet.
        if (main.RootModel.RefreshSchedules.size === 0) {
            return MontanaGateway.Instance.LoadEntities(MainMenuItemType.REFRESH_SCHEDULE, 1000, true);
        }
    }

    public CloseActiveDataSpace(): void {
        if (this.RootModel.ActiveDataSpace?.DataSpace) {
            MontanaSocketGateway.Instance.DavosUnsubscribe();
            MontanaSocketGateway.Instance.UnsubscribeToChanges(
                this.RootModel.ActiveDataSpace.DataSpace._id,
                this.RootModel.ActiveDataSpace.DataSpace.PatchType,
                false
            );
        }
        this.DataSpaceNotFound = false;
        this.RootModel.SetActiveDataSpace(null, false);
        this.DataSpaceMenu.AddingOperators = false;
    }

    @action
    public async CreateNewWorkspace(datasetIds?: string[]): Promise<void> {
        try {
            const workspaceSnapshot = (await MontanaGateway.Instance.CreateWorkspace()) as SnapshotIn<IWorkspace>;
            runInAction(() => {
                const newWorkspace = Workspace.create(workspaceSnapshot);
                this.RootModel.UpdateEntity(MainMenuItemType.WORKSPACE, new Map([[workspaceSnapshot._id, newWorkspace]]), true);
                datasetIds?.forEach((id) => newWorkspace.AddDatasetId(id));
                main.NavigateToSpace(newWorkspace._id, DataSpaceType.Workspace);
            });
        } catch (e) {
            if (e instanceof SubscriptionError) {
                main.Context.ShowToastMessage(
                    new TextToast({
                        message: e.message,
                        intent: Intent.WARNING,
                        buttonLabel: "View subscription...",
                        primaryActionHandler: SubscriptionUtils.OpenUpgradePortal
                    })
                );
            } else {
                main._context.ShowToastMessage(new TextToast({ message: e.message, intent: Intent.DANGER }));
            }
        }
    }

    @action
    public async CreateNewWorkflow(workflow: IWorkflowDescription): Promise<void> {
        const workspaceSnapshot = (await MontanaGateway.Instance.CreateWorkflow(workflow)) as SnapshotIn<IWorkspace>;
        runInAction(() => {
            const newWorkspace = Workspace.create(workspaceSnapshot);
            this.RootModel.UpdateEntity(MainMenuItemType.WORKSPACE, new Map([[workspaceSnapshot._id, newWorkspace]]), true);
            newWorkspace.SetName(workflow.Name);
            for (const workflowDatasetName of workflow.Datasets) {
                const datasetId = main.Context.GetRoot().Realm.WorkflowDatasets.get(workflowDatasetName);
                if (datasetId) {
                    newWorkspace.AddDatasetId(datasetId);
                } else {
                    ErrorLogger.Log("Could not find dataset id in realm for workflow dataset named " + workflowDatasetName);
                }
            }
            main.WorkflowState.SetWorkflowJustCreated(true);
            main.Context.GetRoot().User.SetActiveWorkflow(workflow, newWorkspace._id);
            main.NavigateToSpace(newWorkspace._id, DataSpaceType.Workspace);
        });
    }

    @action
    public DuplicateWorkspace(workspace: IWorkspace): Promise<IWorkspace> {
        return new Promise((resolve, reject) => {
            MontanaGateway.Instance.DuplicateWorkspace(workspace).then((result) => {
                const newWorkspaceId = result._id;
                MontanaGateway.Instance.LoadEntities(MainMenuItemType.WORKSPACE).then(
                    action(() => {
                        this._context.GetRoot().Workspaces.get(newWorkspaceId).UpdateScreenshotTimestamp();
                        resolve(result);
                    })
                );
            });
        });
    }

    @action
    public DuplicateDataset(dataset: IDataset): void {
        MontanaGateway.Instance.DuplicateDataset(dataset).then((result) => {
            MontanaGateway.Instance.LoadEntities(MainMenuItemType.DATASET);
        });
    }

    @action
    public DuplicateRefreshSchedule(schedule: IRefreshSchedule): void {
        MontanaGateway.Instance.DuplicateRefreshSchedule(schedule)
            .then((result) => {
                MontanaGateway.Instance.LoadEntities(MainMenuItemType.REFRESH_SCHEDULE);
            })
            .catch((e: Error) => {
                if (e instanceof SubscriptionError) {
                    main.Context.ShowToastMessage(
                        new TextToast({
                            message: e.message,
                            intent: Intent.WARNING,
                            buttonLabel: "View subscription...",
                            primaryActionHandler: SubscriptionUtils.OpenUpgradePortal
                        })
                    );
                } else {
                    main._context.ShowToastMessage(new TextToast({ message: e.message, intent: Intent.DANGER }));
                }
            });
    }

    @action
    public DuplicateUserOperator(userOperator: IUserOperator): void {
        MontanaGateway.Instance.DuplicateUserOperator(userOperator).then(() => {
            MontanaGateway.Instance.LoadEntities(MainMenuItemType.USER_OPERATOR);
        });
    }

    @action
    public DuplicateUserOperatorSynchronization(sync: IUserOperatorSynchronization): void {
        MontanaGateway.Instance.DuplicateUserOperatorSynchronization(sync).then((result) => {
            MontanaGateway.Instance.LoadEntities(MainMenuItemType.USER_OPERATOR_SYNCHRONIZATION);
        });
    }

    public UploadMultipleCsvs(files: File[]): void {
        let doneUploads = 0;
        if (main.IsOnboardingShown) {
            main.OnboardingState.SetViewState(new FileUploadingViewState(), false);
        }
        files.forEach((file) =>
            this.UploadCsv(file, CsvUploadUtil.GetOptionsForQuickUpload(file), (datasetId: string) => {
                if (++doneUploads === files.length) {
                    main.GetDatasetByIdAndSwitchToPreview(datasetId).then(() => {
                        if (main.IsOnboardingShown) {
                            main.OnboardingState.SetViewState(new PreviewViewState(), true);
                        }
                    });
                }
            })
        );
    }

    private addDatasetToRootState(context: IAppContext, dataset: IDataset): void {
        context.GetRoot().UpdateEntity(MainMenuItemType.DATASET, new Map([[dataset._id, dataset]]), true);
    }

    @action
    public UploadCsv(
        file: File,
        customOptions?: { Name: string; FormatOptions: ICsvFormatType },
        onCompleteHandler?: (datasetId: string) => void
    ): Promise<void> {
        const fileName = customOptions ? customOptions.Name : file.name;

        if (main.Context.GetRoot().Realm.IsSaaS && file?.size > Settings.Instance.MaxUploadFileSize) {
            this._context.ShowToastMessage(
                new TextToast({
                    message: `${fileName} exceeds max allowed upload size of ${ValueFormatter.FormatBytes(
                        Settings.Instance.MaxUploadFileSize
                    )}`
                })
            );
            return;
        }

        // eslint-disable-next-line
        const that = this;
        const progressId = Utils.GenerateId();
        const request = MontanaGateway.Instance.UploadCsv(
            file,
            action((event) => {
                if (event.status !== "ok") {
                    that._context.ShowToastMessage(new TextToast({ message: event.message, intent: Intent.DANGER }));
                    that.ToastState.CompleteProgressInstance(progressId);
                    onCompleteHandler?.(null);
                    return;
                } else {
                    that.ToastState.CompleteProgressInstance(progressId);
                }
                const newDataset: ICsvFile = CsvFile.create(event.dataset);
                that.addDatasetToRootState(that._context, newDataset);

                that.PostAddDataset(newDataset);
                that._context.GetRoot().RefreshRealm();
                that.RemoveRequestInProgress(progressId);
                onCompleteHandler?.(newDataset._id);
            }),
            (progress) => {
                runInAction(() => {
                    this.UploadProgress = progress;
                    this.ToastState.ShowToast(
                        new ProgressToast({
                            progressId,
                            progressTaskName: fileName,
                            primaryActionHandler: () => this.CancelRequest(progressId),
                            progressPercent: progress * 100
                        })
                    );
                });
            },
            customOptions
        );
        this.RequestsInProgress.push({ progressId, request });
    }

    @action
    public UploadZippedCsvs(file: File): void {
        if (main.Context.GetRoot().Realm.IsSaaS && file.size > Settings.Instance.MaxUploadFileSize) {
            this._context.ShowToastMessage(
                new TextToast({
                    message: "File exceeds max allowed upload size of " + ValueFormatter.FormatBytes(Settings.Instance.MaxUploadFileSize)
                })
            );
            return;
        }

        // eslint-disable-next-line
        const that = this;
        const progressId = Utils.GenerateId();
        const request = MontanaGateway.Instance.UploadZippedCsvs(
            file,
            flow(function* (e) {
                if (e.status !== "ok") {
                    that._context.ShowToastMessage(new TextToast({ message: e.message, intent: Intent.DANGER }));
                    that.ToastState.CompleteProgressInstance(progressId);
                    return;
                } else {
                    that._context.ShowToastMessage(new TextToast({ message: file.name + " uploaded", intent: Intent.SUCCESS }));
                    that.ToastState.CompleteProgressInstance(progressId);
                }
                const currentWorkspace = main.Context.GetRoot().ActiveDataSpace?.DataSpace as IWorkspace;
                e.datasets.forEach((dataset: SnapshotIn<IDataset>) => {
                    const newDataset: ICsvFile = CsvFile.create(dataset);
                    that.addDatasetToRootState(that._context, newDataset);
                    if (currentWorkspace) {
                        currentWorkspace.AddDatasetId(dataset._id);
                    }
                });
                if (currentWorkspace) {
                    yield MontanaGateway.Instance.UpdateDatasetIds(currentWorkspace);
                    yield main.UpdateDatasetsInDataSpace(currentWorkspace);
                }
                yield MontanaGateway.Instance.SearchByKeyword();
                that._context.GetRoot().RefreshRealm();
                that.RemoveRequestInProgress(progressId);
            }),
            (progress) => {
                runInAction(() => {
                    this.UploadProgress = progress;
                    this.ToastState.ShowToast(
                        new ProgressToast({
                            progressId,
                            progressTaskName: file.name,
                            primaryActionHandler: () => this.CancelRequest(progressId),
                            progressPercent: progress * 100
                        })
                    );
                });
            }
        );
        this.RequestsInProgress.push({ progressId, request });
    }

    public CancelRequest(progressId: string): void {
        const request = this.RequestsInProgress.find((obj) => obj.progressId === progressId).request;
        request.abort();
        this.RemoveRequestInProgress(progressId);
        if (main.IsOnboardingShown) {
            main.OnboardingState.ReEstablishCurrentViewState();
        }
    }

    public RemoveRequestInProgress(progressId: string): void {
        this.RequestsInProgress = this.RequestsInProgress.filter((requestObj) => requestObj.progressId !== progressId);
    }

    public ReplaceCsv(dataset: ICsvFile, file: File): Promise<void> {
        return new Promise<void>((resolver) => {
            if (file && file.size > Settings.Instance.MaxUploadFileSize) {
                this._context.ShowToastMessage(
                    new TextToast({
                        message:
                            "File exceeds max allowed upload size of " + ValueFormatter.FormatBytes(Settings.Instance.MaxUploadFileSize)
                    })
                );
                return;
            }

            dataset.SetLastExecutedVersionHash(null);
            dataset.SetSubscribeResponse(null);
            const progressId = Utils.GenerateId();
            MontanaGateway.Instance.UpdateCSVDataset(
                file,
                dataset._id,
                (e) => {
                    runInAction(() => {
                        if (e.status !== "ok") {
                            this._context.ShowToastMessage(new TextToast({ message: e.message, intent: Intent.DANGER }));
                            this.ToastState.CompleteProgressInstance(progressId);
                            return;
                        } else {
                            this.ToastState.CompleteProgressInstance(progressId);
                        }
                        resolver();
                        this._context.GetRoot().RefreshRealm();
                        this.RemoveRequestInProgress(progressId);
                    });
                },
                (progress) => {
                    runInAction(() => {
                        this.UploadProgress = progress;
                        this.ToastState.ShowToast(
                            new ProgressToast({
                                progressId,
                                progressTaskName: file.name,
                                primaryActionHandler: () => this.CancelRequest(progressId),
                                progressPercent: progress * 100
                            })
                        );
                    });
                }
            );
        });
    }

    @action
    public AddGoogleSpreadsheet(datasetModel: IGoogleSheet): Promise<IDataset> {
        return MontanaGateway.Instance.AddGoogleSpreadsheet(datasetModel).then((datasetSnapshot) => {
            const dataset = this.PostAddDataset(GoogleSheet.create(datasetSnapshot));
            main.MainMenu.SetDialogState(new DatasetPreviewDialogState(dataset));
            return dataset;
        });
    }

    @action
    public AddTelemetryDataset(): void {
        MontanaGateway.Instance.AddTelemetryDataset().then((id) => {
            this.PostAddDataset(main.Context.GetRoot().Datasets.get(id));
        });
    }

    @action
    public AddSqlDataset(datasetModel: IDataset): Promise<ISqlDataset> {
        return MontanaGateway.Instance.AddSqlDataset(datasetModel).then((datasetSnapshot) => {
            const dataset = this.PostAddDataset(SqlDataset.create(datasetSnapshot));
            return dataset as ISqlDataset;
        });
    }

    @action
    public AddS3Dataset(datasetModel: IDataset): Promise<IS3File> {
        return MontanaGateway.Instance.AddS3Dataset(datasetModel).then((datasetSnapshot) => {
            const dataset = this.PostAddDataset(S3File.create(datasetSnapshot));
            return dataset as IS3File;
        });
    }

    public async AddDataConnector(dataConnector: IDataConnector): Promise<IDataConnector> {
        const dataConnectorSnapshot = await MontanaGateway.Instance.AddDataConnector(dataConnector);
        const connector = DataConnector.create(dataConnectorSnapshot, main.Context);
        main.Context.GetRoot().UpdateEntity(MainMenuItemType.DATA_CONNECTOR, new Map([[connector._id, connector]]), true);
        return main.Context.GetRoot().DataConnectors.get(connector._id);
    }

    @action
    public AddRefreshSchedule(refreshSchedule: IRefreshSchedule): void {
        MontanaGateway.Instance.AddRefreshSchedule(refreshSchedule)
            .then((id) => {
                main.MainMenu.SetDialogState(null);
                MontanaGateway.Instance.LoadEntities(MainMenuItemType.REFRESH_SCHEDULE);
                main.Context.ShowToastMessage(new TextToast({ message: "Schedule created" }));
            })
            .catch((e: Error) => {
                if (e instanceof SubscriptionError) {
                    main.Context.ShowToastMessage(
                        new TextToast({
                            message: e.message,
                            intent: Intent.WARNING,
                            buttonLabel: "View subscription...",
                            primaryActionHandler: SubscriptionUtils.OpenUpgradePortal
                        })
                    );
                } else {
                    main._context.ShowToastMessage(new TextToast({ message: e.message, intent: Intent.DANGER }));
                }
            });
    }

    @action
    public AddParquetDataset(datasetModel: IParquetFile): void {
        MontanaGateway.Instance.AddParquetDataset(datasetModel).then((id) => {
            main.MainMenu.SetDialogState(null);
            MontanaGateway.Instance.LoadEntities(MainMenuItemType.DATASET);
        });
    }

    @action
    public UpdateGoogleSpreadsheet(datasetId: string): Promise<void> {
        return MontanaGateway.Instance.UpdateGoogleSpreadsheet(datasetId).then((result) => {
            MontanaGateway.Instance.LoadEntities(MainMenuItemType.DATASET);
        });
    }

    @action
    public SetAuthenticated(value: boolean): void {
        this.IsAuthenticated = value;
    }

    @action
    public SetViewMode(viewMode: ViewMode): void {
        this.ViewMode = viewMode;
    }

    public async UpdateDatasetsInDataSpace(dataSpace: IWorkspace | IDashboard | IDevSpace): Promise<void> {
        const loadedDatasetModels: IAnyDataset[] = await MontanaGateway.Instance.LoadDatasetsByIds(Array.from(dataSpace.DatasetIds.keys()));
        main.Context.GetRoot().UpdateEntity(MainMenuItemType.DATASET, new Map(loadedDatasetModels.map((d) => [d._id, d])), true);
        const rootComps = Array.from(dataSpace.RootComputations.values());
        rootComps.forEach((cmp) => {
            OperatorUtil.UpdateDatasetVersionHash(dataSpace, cmp);
        });

        return OperatorUtil.CreateRootComputationsFromDatasets(dataSpace, loadedDatasetModels);
    }

    public JoinCall(dataSpaceId: string): Promise<void> {
        // eslint-disable-next-line no-console
        console.log("join call");
        this.Call = new Call();
        return this.Call.JoinCall(dataSpaceId);
    }

    public StopCall(): void {
        // eslint-disable-next-line no-console
        console.log("stop call");
        if (this.Call) {
            this.Call.StopCall();
            this.Call = null;
        }
    }

    public get Context(): IAppContext {
        return this._context;
    }

    public SetActiveHelpLink(url: string): void {
        this.ActiveHelpLink = url;
    }

    get LiveState(): LiveState {
        const activeDataSpace = this.Context.GetRoot().ActiveDataSpace;
        if (!activeDataSpace) {
            return LiveState.NO_ONE_LIVE;
        }

        if (this.Call?.CallState) {
            return LiveState.LIVE;
        }

        return [...activeDataSpace.Heartbeats.values()].some((heartbeat: IHeartbeat) => heartbeat.LiveParticipantId)
            ? LiveState.OTHERS_LIVE
            : LiveState.NO_ONE_LIVE;
    }

    public static GetDatasetEditingCategory = (dataset: IAnyDataset): MainMenuEditingCategory | null => {
        // cannot use methods like S3File.is() because dataset returned by search endpoint is missing properties
        switch (dataset.__discriminator) {
            case "ParquetFile":
                return MainMenuEditingCategory.ParquetFile;
            case "S3File":
                return MainMenuEditingCategory.S3File;
            case "SqlDataset":
                return MainMenuEditingCategory.SqlDataset;
            case "CsvFile":
                return MainMenuEditingCategory.CsvFile;
            default:
                return null;
        }
    };

    public GetDatasetByIdAndEdit(datasetId: string): void {
        MontanaGateway.Instance.GetDatasetById(datasetId).then(
            action((dataset: IAnyDataset) => {
                if (dataset !== null) {
                    main.Context.GetRoot().UpdateEntity(
                        MainMenuItemType.DATASET,
                        new Map<string, IAnyDataset>([[dataset._id, dataset]]),
                        true
                    );
                    const newDataset = this.Context.GetRoot().Datasets.get(datasetId);
                    if (CsvFile.is(newDataset)) {
                        main.MainMenu.SetDialogState(new CsvDatasetDetailsDialogState(newDataset as ICsvFile));
                    } else if (SqlDataset.is(newDataset)) {
                        main.MainMenu.SetDialogState(new SqlDatasetDetailsDialogState(newDataset as ISqlDataset));
                    } else if (S3File.is(newDataset)) {
                        main.MainMenu.SetDialogState(new S3DatasetDetailsDialogState(newDataset as IS3File));
                    } else if (GoogleSheet.is(newDataset)) {
                        main.MainMenu.SetDialogState(new GSheetDatasetDetailsDialogState(newDataset as IGoogleSheet));
                    }
                }
            })
        );
    }

    public GetRefreshScheduleByIdAndOpenSidePanel(scheduleId: string): void {
        MontanaGateway.Instance.GetRefreshScheduleById(scheduleId).then(
            action((schedule: IRefreshSchedule) => {
                if (schedule !== null) {
                    main.Context.GetRoot().UpdateEntity(
                        MainMenuItemType.REFRESH_SCHEDULE,
                        new Map<string, IRefreshSchedule>([[schedule._id, schedule]]),
                        true
                    );
                    main.MainMenu.SetDialogState(new RefreshScheduleDialogState(this.Context.GetRoot().RefreshSchedules.get(schedule._id)));
                }
            })
        );
    }

    public GetDatasetByIdAndSwitchToPreview(datasetId: string): Promise<void> {
        const possibleDatasetFromSearchEndpoint = main.Context.GetRoot().Datasets.get(datasetId);
        if (possibleDatasetFromSearchEndpoint && !possibleDatasetFromSearchEndpoint.IsEditable) {
            return new Promise((resolver) => resolver());
        }
        return MontanaGateway.Instance.GetDatasetById(datasetId).then(
            action((dataset: IAnyDataset) => {
                if (dataset !== null) {
                    main.Context.GetRoot().UpdateEntity(
                        MainMenuItemType.DATASET,
                        new Map<string, IAnyDataset>([[dataset._id, dataset]]),
                        true
                    );
                    main.MainMenu.SetDialogState(new DatasetPreviewDialogState(this.Context.GetRoot().Datasets.get(dataset._id)));
                }
            })
        );
    }

    public NavigateToSpace(id: string, type: DataSpaceType, subtypeId?: string, subtype?: DataSpaceType): void {
        this.MainMenu.CloseMainMenuItemDialog();
        const getTypeLetter = (type: DataSpaceType) => {
            let typeLetter: string;
            if (type === DataSpaceType.Workspace) {
                typeLetter = "w";
            } else if (type === DataSpaceType.DevSpace) {
                typeLetter = "o";
            } else if (type === DataSpaceType.Dashboard) {
                typeLetter = "d";
            }
            return typeLetter;
        };
        const baseURL = `${window.location.protocol}//${window.location.host}`;
        window.history.pushState(
            {},
            "einblick",
            `${baseURL}/?${getTypeLetter(type)}=${id}` + (subtypeId ? `&${getTypeLetter(subtype)}=${subtypeId}` : "")
        );
    }

    @computed
    public get IsUploading(): boolean {
        return this.RequestsInProgress.length > 0;
    }
}
